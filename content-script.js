const socialIndicatorClass = 'which-social-provider';
const socialStorageKey = `${location.href}_social`;

const socialStorageType = {
    ID: 'ID',
    DATASET: 'DATASET',
    TEXT_CONTENT: 'TEXT_CONTENT',
};

function getSocialStorageValue(elem) {
    let value = {
        value: elem.textContent.trim(),
        type: socialStorageType.TEXT_CONTENT,
    };

    // if (elem.dataset) {
    //     value = {
    //         value: JSON.stringify(elem.dataset),
    //         type: socialStorageType.DATASET,
    //     };
    // }

    if (elem.id) {
        value = {
            value: elem.id,
            type: socialStorageType.ID,
        };
    }
    return JSON.stringify(value);
}

function getSocialElem(callback) {
    chrome.storage.sync.get([socialStorageKey], (result) => {
        console.log('Value currently is ', result[socialStorageKey]);
        if (result === undefined) {
            callback();
            return;
        }
        const { value, type } = JSON.parse(result[socialStorageKey]);
        switch (type) {
            case socialStorageType.ID:
                callback(document.getElementById(value));
                break;
            // case socialStorageType.DATASET:
            //     callback(elem);
            //     break;
            case socialStorageType.TEXT_CONTENT:
                callback(
                    getNodesWithTextPattern(
                        new RegExp(value)
                    )[0].parentElement.closest('button, a')
                );
                break;
        }
    });
}

function saveSocial(elem) {
    const value = getSocialStorageValue(elem);
    chrome.storage.sync.set({ [socialStorageKey]: value }, () => {
        console.log('Value is set to ' + value);
    });
}

function getNodesWithTextPattern(pattern, root = document.body) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    const elems = [];
    while ((node = walker.nextNode())) {
        if (pattern.test(node.textContent)) {
            console.log('NODE FOUND FOR ', pattern, node);
            elems.push(node);
        }
    }
    return elems;
}

function getLoginElems() {
    const textNodes = getNodesWithTextPattern(/(Log ?in with|Sign ?in with)/);
    return textNodes.map((node) => node.parentElement.closest('button, a'));
}

function registerClickListeners() {
    const loginElems = getLoginElems();

    for (const loginElem of loginElems) {
        loginElem.addEventListener('click', () => saveSocial(loginElem));
    }
}

function displaySavedSocialIndicator() {
    getSocialElem((elem) => {
        if (!elem) return;
        elem.classList.add(socialIndicatorClass);
    });
}

function setup() {
    registerClickListeners();
    displaySavedSocialIndicator();
}

setup();
