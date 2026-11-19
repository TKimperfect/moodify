// Loads YouTube's official IFrame Player API once (https://www.youtube.com/iframe_api).
let loading = null;

export function loadYouTubeApi(timeoutMs = 10_000) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      loading = null;
      reject(new Error('YouTube could not be loaded'));
    }, timeoutMs);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      loading = null;
      reject(new Error('YouTube could not be loaded'));
    };
    document.head.append(script);
  });
  return loading;
}

// What the error codes from the YouTube player mean.
export function youtubeErrorMessage(code) {
  if (code === 101 || code === 150) return 'The owner of this video does not allow it to play on other sites';
  if (code === 100) return 'This video is no longer on YouTube';
  return 'YouTube could not play this video';
}
