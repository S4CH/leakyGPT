let pendingRequest = null;
let regexes = [];

function loadRegexes() {
  fetch(chrome.runtime.getURL('regexes.json'))
    .then(response => response.json())
    .then(data => {
      regexes = data.map(item => ({
        regex: new RegExp(item.Regex, 'i'),
        title: item.Title
      }));
    })
    .catch(err => console.error('Error loading regexes:', err));
}

chrome.runtime.onInstalled.addListener(() => {
  loadRegexes();
});

chrome.runtime.onStartup.addListener(() => {
  loadRegexes();
});

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (details.url.includes('/backend-api/conversation')) {
      if (details.requestBody && details.requestBody.raw) {
        const requestBody = new TextDecoder().decode(new Uint8Array(details.requestBody.raw[0].bytes));
        const parsedBody = JSON.parse(requestBody);
        
        if (parsedBody.messages && parsedBody.messages.length > 0) {
          const parts = parsedBody.messages[0].content.parts;
          let exposedTitles = [];

          for (const part of parts) {
            for (const item of regexes) {
              if (item.regex.test(part)) {
                exposedTitles.push(item.title);
              }
            }
          }

          if (exposedTitles.length > 0) {
            const titlesString = exposedTitles.join(', ');
            let userResponse = confirm(`leakyGPT discovered the following secret exposures: ${titlesString}. Do you still want to proceed with submitting your message?`);
            if (!userResponse) {
              return { cancel: true };
            }
          }
        }

        pendingRequest = details;

        return { cancel: false };
      }
    }
    return { cancel: false };
  },
  { urls: ["*://chatgpt.com/backend-api/conversation"] },
  ["requestBody", "blocking"]
);
