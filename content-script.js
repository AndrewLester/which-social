const socialIndicatorClass = 'which-social-provider';
const socialIndicatorChildClass = 'which-social-provider-child';
const socialObservingClass = 'which-social-potential-provider';
const socialMessageShownClass = 'which-social-message-shown';
const socialStorageKey = `${new URL(location.href).hostname}_social`;
const socialProvidersKey = 'social-providers';
const socialMessageClass = 'which-social-message';

const Setting = {
    DISABLE_THIS_SITE: 'disable-this-site-PAGE_URL',
    DISABLE_WHICH_SOCIAL: 'disable-which-social',
    SAVED_SOCIAL_COLOR: 'saved-social-color',
};

async function getSettingValue(setting) {
    const hostname = new URL(location.href).hostname;
    const storageKey = setting.replace('PAGE_URL', hostname);
    return new Promise((resolve) => {
        chrome.storage.sync.get(storageKey, (result) => {
            if (!result || !result[storageKey]) resolve(null);
            resolve(result[storageKey]);
        });
    });
}

function getSocialTextPattern(providers) {
    return new RegExp(
        `(?:(?:(?:(?:(?:Log|Sign) ?(?:in|up))|Continue) with )|^)(${providers.join(
            '|'
        )})(?: (?:Log|Sign) ?(?:in|up))?\\.?$`,
        'i'
    );
}

function getSavedSocial() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([socialStorageKey], (result) => {
            if (!result || !result[socialStorageKey]) {
                resolve(null);
                return;
            }
            const { provider } = JSON.parse(result[socialStorageKey]);
            resolve(provider);
        });
    });
}

function saveSocial({ provider }) {
    chrome.storage.sync.set({
        [socialStorageKey]: JSON.stringify({ provider }),
    });
}

function getTextNodesWithPattern(
    pattern,
    filterMatches = (m) => m,
    root = document.body
) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        null,
        false
    );

    let node;
    const elems = [];
    while ((node = walker.nextNode())) {
        const matches =
            node.nodeType === Node.TEXT_NODE
                ? node.textContent.trim().match(pattern)
                : node.alt
                ? node.alt.trim().match(pattern)
                : undefined;
        if (matches) {
            elems.push({
                node,
                matches: filterMatches(matches),
            });
        }
    }
    return elems;
}

function getSocialLogins(root, socialProviders) {
    const textNodes = getTextNodesWithPattern(
        getSocialTextPattern(socialProviders),
        (matches) => [matches[1]],
        root
    );
    return textNodes
        .filter(({ node, matches }) => {
            const clickableNode =
                node.parentElement.closest('button, a') || node.parentElement;

            if (clickableNode.tagName !== 'A') return true;

            let url;
            try {
                url = new URL(clickableNode.href);
            } catch {
                return true;
            }

            return !url.hostname.includes(matches[0].toLowerCase());
        })
        .map(({ node, matches }) => {
            return {
                node:
                    node.parentElement.closest('button, a') ||
                    node.parentElement,
                provider: matches[0],
            };
        });
}

const addedNodes = new Set([]);

function registerClickListeners(root, socialProviders) {
    const socialLogins = [
        ...new Set(getSocialLogins(root, socialProviders)),
    ].filter(({ node }) => !addedNodes.has(node));

    for (const socialLogin of socialLogins) {
        socialLogin.node.addEventListener('click', () =>
            saveSocial(socialLogin)
        );
        addedNodes.add(socialLogin.node);
    }

    return socialLogins;
}

function appendSocialMessage(elem) {
    const wrapper = document.createElement('div');
    wrapper.textContent = 'Recently used on this site';
    wrapper.className = socialMessageClass;
    const wrapperRect = elem.getBoundingClientRect();
    wrapper.style.setProperty(
        '--right',
        `${
            -window.scrollX +
            (document.documentElement.clientWidth - wrapperRect.right)
        }px`
    );
    wrapper.style.setProperty(
        '--top',
        `${window.scrollY + wrapperRect.top + wrapperRect.height}px`
    );
    wrapper.style.position =
        elem.style.position === 'fixed' ? 'fixed' : 'absolute';
    document.body.appendChild(wrapper);
}

const observing = new Set([]);

async function displaySavedSocialIndicator(socialLogins) {
    const savedSocial = await getSavedSocial();
    if (!savedSocial) {
        return;
    }

    const socialLogin = socialLogins.find(
        ({ provider }) => provider === savedSocial
    );
    if (!socialLogin) {
        return;
    }
    const { node } = socialLogin;

    if (
        node.style.display === 'none' ||
        node.style.visibility === 'hidden' ||
        node.offsetParent === null ||
        node.classList.contains(socialMessageShownClass)
    ) {
        let reason =
            node.style.display === 'none'
                ? 'display'
                : node.style.visibility === 'hidden'
                ? 'visibility'
                : node.offsetParent === null
                ? 'No parent (not mounted)'
                : node.classList.contains(socialMessageShownClass)
                ? 'Already placed indicator'
                : 'none';

        if (observing.has(node)) return;

        observing.add(node);
        node.classList.add(socialObservingClass);
        return;
    }

    // if (node.tagName === 'A' && node.firstElementChild)
    // node.firstElementChild.classList.add(socialIndicatorChildClass);
    node.classList.add(socialIndicatorClass);
    node.classList.remove(socialObservingClass);
    node.classList.add(socialMessageShownClass);
    // node.whichSocialIndicator = true;
    appendSocialMessage(node);
}

let socialLogins = [];
let socialProviders = [];
async function applyWhichSocial(root) {
    socialProviders =
        socialProviders.length === 0
            ? await getSettingValue(socialProvidersKey)
            : socialProviders;
    socialLogins.push(...registerClickListeners(root, socialProviders));
    displaySavedSocialIndicator(socialLogins);
}

function hideSavedSocialIndicator() {
    const buttons = document.getElementsByClassName(socialIndicatorClass);
    const messages = document.getElementsByClassName(socialMessageClass);

    if (messages.length > 0)
        [...messages].forEach((message) => message.remove());
    if (buttons.length > 0) {
        [...buttons].forEach((button) =>
            button.classList.remove(
                socialIndicatorClass,
                socialMessageShownClass
            )
        );
    }
}

const displayObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (
            mutation.type !== 'attributes' ||
            !(mutation.target instanceof HTMLElement)
        ) {
            return;
        }

        const observingChildren =
            mutation.target.getElementsByClassName(socialObservingClass);

        if (observingChildren.length === 0) return;

        displaySavedSocialIndicator(socialLogins);
    }
});

displayObserver.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['style'],
});

const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type !== 'childList') {
            return;
        }

        const addedMessage =
            [...mutation.addedNodes]
                .filter((node) => node instanceof HTMLElement)
                .find((node) => node.classList.contains(socialMessageClass)) !==
            undefined;

        const removedButton =
            [...mutation.removedNodes]
                .filter((node) => node instanceof HTMLElement)
                .find(
                    (elem) =>
                        elem.getElementsByClassName(socialIndicatorClass)
                            .length > 0
                ) !== undefined;
        if (!addedMessage && mutation.addedNodes.length > 0) {
            applyWhichSocial(mutation.target);
        } else if (removedButton && mutation.removedNodes.length > 0) {
            hideSavedSocialIndicator();
        }
    }
});

mutationObserver.observe(document.body, { childList: true, subtree: true });

const resizeObserver = new ResizeObserver(async () => {
    hideSavedSocialIndicator();
    await sleep(200); // TODO: Remove this
    displaySavedSocialIndicator(socialLogins);
});

resizeObserver.observe(document.body);

function sleep(millis) {
    return new Promise((resolve) => setTimeout(resolve, millis));
}

const colorThreshold = 186;
function computeTextColor(color) {
    color = color.slice(1);
    const [red, green, blue] = [
        color.slice(0, 2),
        color.slice(2, 4),
        color.slice(4, 6),
    ].map((hex) => parseInt(hex, 16));
    if (red * 0.299 + green * 0.587 + blue * 0.114 > colorThreshold) {
        return '#000';
    }
    return '#fff';
}

async function setup() {
    const [disableOnThisSite, disableWhichSocial] = await Promise.all([
        getSettingValue(Setting.DISABLE_THIS_SITE),
        getSettingValue(Setting.DISABLE_WHICH_SOCIAL),
    ]);
    if (disableOnThisSite || disableWhichSocial) return;

    const whichSocialColor = await getSettingValue(Setting.SAVED_SOCIAL_COLOR);
    const whichSocialTextColor = computeTextColor(whichSocialColor);
    document.documentElement.style.setProperty(
        '--which-social-color',
        whichSocialColor
    );
    document.documentElement.style.setProperty(
        '--which-social-text-color',
        whichSocialTextColor
    );
    applyWhichSocial(document.body);
}

setup();
