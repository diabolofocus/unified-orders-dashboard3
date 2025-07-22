// utils/image-processor.ts
export const processWixImageUrl = (imageString: string): string => {
  if (!imageString || typeof imageString !== 'string') return '';

  if (imageString.startsWith('wix:image://v1/')) {
    const imageId = imageString.replace('wix:image://v1/', '').split('#')[0];

    // Try multiple URL formats for better compatibility
    const possibleUrls = [
      `https://static.wixstatic.com/media/${imageId}?w=100&h=100&fit=fill&f=jpg`,
      `https://static.wixstatic.com/media/${imageId}`,
      `https://static.wixstatic.com/media/${imageId.split('~')[0]}`
    ];

    return possibleUrls[0]; // Return the first (most specific) URL
  }

  if (imageString.startsWith('wix:image://')) {
    const imageId = imageString
      .replace(/^wix:image:\/\/[^\/]*\//, '')
      .split('#')[0];

    return `https://static.wixstatic.com/media/${imageId}?w=100&h=100&fit=fill&f=jpg`;
  }

  if (imageString.includes('static.wixstatic.com')) {
    try {
      const url = new URL(imageString);
      url.searchParams.set('w', '100');
      url.searchParams.set('h', '100');
      url.searchParams.set('fit', 'fill');
      url.searchParams.set('f', 'jpg');
      return url.toString();
    } catch (error) {
      console.warn('Invalid URL format:', imageString);
      return imageString;
    }
  }

  if (imageString.startsWith('http')) {
    try {
      const url = new URL(imageString);
      url.searchParams.set('w', '100');
      url.searchParams.set('h', '100');
      url.searchParams.set('fit', 'fill');
      url.searchParams.set('f', 'jpg');
      return url.toString();
    } catch (error) {
      return imageString;
    }
  }

  return `https://static.wixstatic.com/media/${imageString}`;
};
// // utils/image-processor.ts
// export const processWixImageUrl = (imageString: string): string => {
//   if (!imageString || typeof imageString !== 'string') return '';

//   if (imageString.startsWith('wix:image://v1/')) {
//     const imageId = imageString
//       .replace('wix:image://v1/', '')
//       .split('#')[0]
//       .split('~')[0];
//     return `https://static.wixstatic.com/media/${imageId}`;
//   }

//   if (imageString.startsWith('wix:image://')) {
//     const imageId = imageString
//       .replace(/^wix:image:\/\/[^\/]*\//, '')
//       .split('#')[0]
//       .split('~')[0];
//     return `https://static.wixstatic.com/media/${imageId}`;
//   }

//   if (imageString.startsWith('http')) return imageString;

//   return `https://static.wixstatic.com/media/${imageString}`;
// };