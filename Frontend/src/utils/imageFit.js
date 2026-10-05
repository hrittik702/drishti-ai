/**
 * Dynamically computes non-cropped initial dimensions constrained to 90% of container.
 * - Portrait: scales height to 90% of container height (bounded by 90% container width).
 * - Landscape: scales width to 90% of container width (bounded by 90% container height).
 * Preserves exact aspect ratio so the image is never cropped.
 *
 * @param {number} naturalWidth 
 * @param {number} naturalHeight 
 * @param {number} containerWidth 
 * @param {number} containerHeight 
 * @returns {{ width: number, height: number, isPortrait: boolean, aspectRatio: number } | null}
 */
export function calculateFitDimensions(naturalWidth, naturalHeight, containerWidth, containerHeight) {
  if (!naturalWidth || !naturalHeight || !containerWidth || !containerHeight) {
    return null;
  }

  const aspectRatio = naturalWidth / naturalHeight;
  const isPortrait = naturalHeight > naturalWidth;
  const maxAllowedWidth = containerWidth * 0.9;
  const maxAllowedHeight = containerHeight * 0.9;

  let width;
  let height;

  if (isPortrait) {
    // Portrait: height takes 90% of container height
    let targetH = maxAllowedHeight;
    let targetW = targetH * aspectRatio;
    // Guard: clamp width if it exceeds 90% of container width to prevent cropping
    if (targetW > maxAllowedWidth) {
      targetW = maxAllowedWidth;
      targetH = targetW / aspectRatio;
    }
    width = Math.round(targetW);
    height = Math.round(targetH);
  } else {
    // Landscape: width takes 90% of container width
    let targetW = maxAllowedWidth;
    let targetH = targetW / aspectRatio;
    // Guard: clamp height if it exceeds 90% of container height to prevent cropping
    if (targetH > maxAllowedHeight) {
      targetH = maxAllowedHeight;
      targetW = targetH * aspectRatio;
    }
    width = Math.round(targetW);
    height = Math.round(targetH);
  }

  return { width, height, isPortrait, aspectRatio };
}
