const disableWhichSocialSettingName = 'disable-which-social';
const socialProvidersKey = 'social-providers';

const currentSiteSocial = document.getElementById('current-site-social');
const refreshMessage = document.getElementById('refresh-message');
const hostnameDisplay = document.getElementById('hostname-display');
const clearSocialButton = document.getElementById('clear-site-setting');
const socialColorPicker = document.getElementById('saved-social-color');
const addProviderInput = document.getElementById('add-provider-input');
const addProviderButton = document.getElementById('add-social-provider');
const providerList = document.getElementById('social-providers');
const settings = document.querySelectorAll('.setting > .switch');

function getHostname() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const url = new URL(tab.url);
            resolve(url.hostname);
        });
    });
}

async function getSocialStorageKey() {
    const hostname = await getHostname();
    return `${hostname}_social`;
}

async function getStorageKeyForSetting(setting) {
    return setting.name.replace('PAGE_URL', await getHostname());
}

async function getSocialProviders() {
    const result = await chrome.storage.sync.get(socialProvidersKey);
    if (!result || !result[socialProvidersKey]) return [];

    return result[socialProvidersKey];
}

function applyGlobalDisable(value) {
    const otherSettings = [...settings].filter(
        (setting) => setting.name !== disableWhichSocialSettingName
    );
    for (const otherSetting of otherSettings) {
        otherSetting.disabled = value;
    }
}

for (const setting of settings) {
    getStorageKeyForSetting(setting).then((storageKey) => {
        chrome.storage.sync.get([storageKey], (result) => {
            const isGlobalDisable =
                setting.name === disableWhichSocialSettingName;

            setting.addEventListener('change', ({ currentTarget }) => {
                if (isGlobalDisable) {
                    applyGlobalDisable(currentTarget.checked);
                }

                chrome.storage.sync.set({
                    [storageKey]: currentTarget.checked,
                });

                refreshMessage.style.display = 'block';
            });

            if (!result || !result[storageKey]) return;
            if (isGlobalDisable) {
                applyGlobalDisable(result[storageKey]);
            }

            setting.style.setProperty('--transition-duration', '0s');
            setting.checked = result[storageKey];
            setTimeout(
                () => setting.style.removeProperty('--transition-duration'),
                10
            );
        });
    });
}

clearSocialButton.addEventListener('click', async () => {
    const socialStorageKey = await getSocialStorageKey();
    chrome.storage.sync.set({
        [socialStorageKey]: null,
    });
    refreshMessage.style.display = 'block';
    clearSocialButton.textContent = 'Cleared ✔';
    setTimeout(() => (clearSocialButton.textContent = 'Clear'), 2500);
});

socialColorPicker.addEventListener('input', () => {
    socialColorPicker.parentElement.style.backgroundColor =
        socialColorPicker.value;
    refreshMessage.style.display = 'block';
});

socialColorPicker.addEventListener('change', async () => {
    const storageKey = await getStorageKeyForSetting(socialColorPicker);
    chrome.storage.sync.set({
        [storageKey]: socialColorPicker.value,
    });
});

getStorageKeyForSetting(socialColorPicker).then((storageKey) => {
    chrome.storage.sync.get([storageKey], (result) => {
        if (!result || !result[storageKey]) return;
        socialColorPicker.parentElement.style.backgroundColor =
            result[storageKey];
    });
});

refreshMessage.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (arrayOfTabs) => {
        chrome.tabs.reload(arrayOfTabs[0].id);
    });
    refreshCurrentSiteSocial();
    renderProviders();
    setTimeout(() => (refreshMessage.style.display = 'none'), 250);
});

addProviderButton.addEventListener('click', async () => {
    const provider = addProviderInput.value;
    if (!provider) return;

    const providers = await getSocialProviders();
    if (
        providers
            .map((provider) => provider.toLowerCase())
            .includes(provider.toLowerCase())
    ) {
        return;
    }

    addProviderInput.value = '';
    providers.push(provider);
    createProviderElem(provider);
    await chrome.storage.sync.set({ [socialProvidersKey]: providers });
    refreshMessage.style.display = 'block';
});

async function refreshCurrentSiteSocial() {
    const socialStorageKey = await getSocialStorageKey();
    const result = await chrome.storage.sync.get(socialStorageKey);
    let message = 'None';
    if (result && result[socialStorageKey]) {
        message = JSON.parse(result[socialStorageKey]).provider;
    }
    currentSiteSocial.textContent = message;
}

function createProviderElem(provider) {
    const elem = document.createElement('div');
    elem.classList.add('social-provider');

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Edit provider';
    input.autocomplete = 'off';
    input.spellcheck = 'false';
    input.value = provider;

    const checkButton = document.createElement('button');
    checkButton.id = 'add-social-provider';
    checkButton.classList.add('icon');
    checkButton.innerHTML = '&check;';
    checkButton.addEventListener('click', async () => {
        if (!input.value) return;

        const providers = await getSocialProviders();
        if (
            providers
                .map((provider) => provider.toLowerCase())
                .includes(input.value.toLowerCase())
        ) {
            return;
        }

        const idx = providers.findIndex((p) => p === provider);
        providers[idx] = input.value;
        provider = input.value;
        await chrome.storage.sync.set({ [socialProvidersKey]: providers });
        refreshMessage.style.display = 'block';
    });

    const deleteButton = document.createElement('button');
    deleteButton.id = 'add-social-provider';
    deleteButton.classList.add('icon');
    deleteButton.innerHTML = '&circleddash;';
    deleteButton.addEventListener('click', async () => {
        const providers = await getSocialProviders();
        providers.splice(
            providers.findIndex((p) => p === provider),
            1
        );
        await chrome.storage.sync.set({ [socialProvidersKey]: providers });
        refreshMessage.style.display = 'block';
        elem.remove();
    });

    elem.appendChild(input);
    elem.appendChild(checkButton);
    elem.appendChild(deleteButton);

    let reference = null;
    for (const child of providerList.children) {
        const innerProvider = child.querySelector('input').value;
        if (
            provider.toLowerCase().localeCompare(innerProvider.toLowerCase()) <
            0
        ) {
            reference = child;
            break;
        }
    }
    providerList.insertBefore(elem, reference);
}

async function renderProviders() {
    providerList.innerHTML = '';
    const providers = await getSocialProviders();
    for (let i = 0; i < providers.length; i++) {
        createProviderElem(providers[i]);
    }
}

refreshCurrentSiteSocial();
getHostname().then((hostname) => (hostnameDisplay.textContent = hostname));
renderProviders();
