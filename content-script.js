const socialProviders = [
    'Google',
    'Facebook',
    'Microsoft',
    'GitHub',
    'Instagram',
    'Snapchat',
    'Discord',
    'Apple',
    'Amazon',
    'Solana',
    'LinkedIn',
];
const badLinks = new Set(['discord.gg', 'github.com']);
const socialIndicatorClass = 'which-social-provider';
const socialIndicatorChildClass = 'which-social-provider-child';
const socialStorageKey = `${location.origin + location.pathname}_social`;
const socialMessageClass = 'which-social-message';

function getSocialTextPattern(providers = socialProviders) {
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
            if (
                result === undefined ||
                result[socialStorageKey] === undefined
            ) {
                resolve(null);
                return;
            }
            const { provider } = JSON.parse(result[socialStorageKey]);
            resolve(provider);
        });
    });
}

function saveSocial({ provider }) {
    console.log('Saving social to: ', provider);
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

function getSocialLogins(root) {
    const textNodes = getTextNodesWithPattern(
        getSocialTextPattern(),
        (matches) => [matches[1]],
        root
    );
    return textNodes
        .filter(({ node }) => {
            const clickableNode =
                node.parentElement.closest('button, a') || node.parentElement;

            if (clickableNode.tagName !== 'A') return true;

            let url;
            try {
                url = new URL(clickableNode.href);
            } catch {
                return true;
            }

            return !badLinks.has(url.hostname.replace('www.', ''));
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

function registerClickListeners(root) {
    const socialLogins = [...new Set(getSocialLogins(root))].filter(
        ({ node }) => !addedNodes.has(node)
    );

    for (const socialLogin of socialLogins) {
        socialLogin.node.addEventListener('click', () =>
            saveSocial(socialLogin)
        );
        addedNodes.add(socialLogin.node);
    }
    if (socialLogins.length > 0) {
        console.log(
            `Registered click listeners for ${socialLogins.length} nodes`,
            socialLogins
        );
    }
    return socialLogins;
}

function appendSocialMessage(elem) {
    const wrapper = document.createElement('div');
    wrapper.textContent = 'Recently used on this site';
    wrapper.className = socialMessageClass;
    const wrapperRect = elem.getBoundingClientRect();
    console.log(wrapperRect);
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

async function displaySavedSocialIndicator(socialLogins) {
    const savedSocial = await getSavedSocial();
    if (!savedSocial) {
        console.log('no saved social');
        return;
    }
    console.log('Loaded saved social: ', savedSocial);
    const socialLogin = socialLogins.find(
        ({ provider }) => provider === savedSocial
    );

    if (!socialLogin) return;
    const { node } = socialLogin;

    if (
        node.style.display === 'none' ||
        node.style.visibility === 'hidden' ||
        node.offsetParent === null ||
        node.whichSocialIndicator
    ) {
        console.log('OBSERVE NODE', node);
        displayObserver.observe(node, { childList: true, subtree: true });
        return;
    }
    console.log('Displayed recently used message on: ', node);
    // if (node.tagName === 'A' && node.firstElementChild)
    // node.firstElementChild.classList.add(socialIndicatorChildClass);
    node.classList.add(socialIndicatorClass);
    node.whichSocialIndicator = true;
    appendSocialMessage(node);
}

let socialLogins = [];
function setup(root) {
    socialLogins = registerClickListeners(root);
    displaySavedSocialIndicator(socialLogins);
}

function hideSavedSocialIndicator() {
    console.log('Hiding indicator');
    const button = document.getElementsByClassName(socialIndicatorClass)[0];
    const messages = document.getElementsByClassName(socialMessageClass);

    if (messages.length > 0)
        [...messages].forEach((message) => message.remove());
    if (button) {
        button.classList.remove(socialIndicatorClass);
        button.whichSocialIndicator = false;
    }
}

setTimeout(() => setup(document.body), 500);

const displayObserver = new MutationObserver((mutations) => {
    console.log('DISPLAY CHANGE', mutations);
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
            setup(mutation.target);
        } else if (removedButton && mutation.removedNodes.length > 0) {
            console.log('Button removed');
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
