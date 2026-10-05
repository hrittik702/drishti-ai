/**
 * Computes fit dimensions for a PPTX slide preserving exact aspect ratio
 * (supports standard 16:9, 4:3, and custom slide ratios) within container.
 *
 * @param {number} slideWidth 
 * @param {number} slideHeight 
 * @param {number} containerWidth 
 * @param {number} containerHeight 
 * @param {number} [padding=40] 
 * @returns {{ width: number, height: number, scale: number, aspectRatio: number } | null}
 */
export function calculateSlideFit(slideWidth, slideHeight, containerWidth, containerHeight, padding = 40) {
  if (!slideWidth || !slideHeight || !containerWidth || !containerHeight) {
    return null;
  }

  const availableW = Math.max(10, containerWidth - padding);
  const availableH = Math.max(10, containerHeight - padding);
  const aspectRatio = slideWidth / slideHeight;

  const scaleW = availableW / slideWidth;
  const scaleH = availableH / slideHeight;
  const scale = Math.min(scaleW, scaleH);

  const width = Math.round(slideWidth * scale);
  const height = Math.round(slideHeight * scale);

  return { width, height, scale, aspectRatio };
}

/**
 * Clamps slide index within 1 to totalSlides.
 *
 * @param {number} index 
 * @param {number} totalSlides 
 * @returns {number}
 */
export function clampSlideIndex(index, totalSlides) {
  if (totalSlides <= 0) return 1;
  return Math.max(1, Math.min(index, totalSlides));
}

/**
 * Determines whether a click is in the spatial navigation edge zone.
 *
 * @param {number} clickX 
 * @param {number} viewportWidth 
 * @param {number} [thresholdRatio=0.15] 
 * @returns {'prev' | 'next' | null}
 */
export function isEdgeClick(clickX, viewportWidth, thresholdRatio = 0.15) {
  if (viewportWidth <= 0) return null;
  const threshold = viewportWidth * thresholdRatio;
  if (clickX <= threshold) return 'prev';
  if (clickX >= viewportWidth - threshold) return 'next';
  return null;
}

/**
 * Evaluates touch displacement to determine horizontal swipe navigation.
 *
 * @param {number} startX 
 * @param {number} startY 
 * @param {number} endX 
 * @param {number} endY 
 * @param {number} [minDistance=50] 
 * @returns {'next' | 'prev' | null}
 */
export function detectSwipeDirection(startX, startY, endX, endY, minDistance = 50) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;

  // Ignore if vertical movement dominates horizontal movement
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    return null;
  }

  if (deltaX <= -minDistance) {
    return 'next'; // Swiped left -> advance
  }
  if (deltaX >= minDistance) {
    return 'prev'; // Swiped right -> go back
  }

  return null;
}
