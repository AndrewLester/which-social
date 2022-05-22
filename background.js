const defaultSocialProviders = [
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
    'Twitter',
];
const defaultSavedSocialColor = '#008000';
const socialProvidersKey = 'social-providers';
const savedSocialColorKey = 'saved-social-color';

chrome.runtime.onInstalled.addListener(async () => {
    await chrome.storage.sync.set({
        [socialProvidersKey]: defaultSocialProviders,
    });
    await chrome.storage.sync.set({
        [savedSocialColorKey]: defaultSavedSocialColor,
    });
    console.log('Successfully installed!');
});
