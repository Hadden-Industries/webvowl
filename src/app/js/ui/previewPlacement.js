export function overlaps(a, b, gap = 0) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width > b.x - gap &&
    a.y < b.y + b.height + gap &&
    a.y + a.height > b.y - gap
  );
}

/** Pure keep-clear placement. A retained valid position avoids following ticks. */
export function placeEntityPreview({
  width,
  height,
  cardWidth,
  cardHeight,
  anchor,
  compact,
  previous,
  obstacles = [],
  topInset = 64,
  bottomInset = 16,
}) {
  const margin = 12;
  const maxX = Math.max(margin, width - cardWidth - margin);
  const maxY = Math.max(margin, height - cardHeight - bottomInset);
  const minY = Math.min(topInset, maxY);
  const clamp = ({ x, y }) => ({
    x: Math.max(margin, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
    width: cardWidth,
    height: cardHeight,
  });
  const target = anchor && {
    x: anchor.xPx - anchor.widthPx / 2,
    y: anchor.yPx - anchor.heightPx / 2,
    width: anchor.widthPx,
    height: anchor.heightPx,
  };
  const offscreen = target && !overlaps(target, { x: 0, y: 0, width, height });
  const clearsControls = (candidate) =>
    obstacles.every((box) => !overlaps(candidate, box, 8));
  if (!target || offscreen) {
    const corners = [
      { x: maxX, y: maxY },
      { x: margin, y: minY },
      { x: margin, y: maxY },
      { x: maxX, y: minY },
    ].map(clamp);
    const candidate = corners.find(clearsControls) ?? corners[0];
    return {
      ...candidate,
      offscreen: Boolean(offscreen),
      overlapsAnchor: false,
    };
  }
  const retained = previous && {
    ...previous,
    width: cardWidth,
    height: cardHeight,
  };
  if (
    retained &&
    retained.x >= margin &&
    retained.x <= maxX &&
    retained.y >= minY &&
    retained.y <= maxY &&
    !overlaps(retained, target, 16) &&
    clearsControls(retained) &&
    (compact ||
      Math.hypot(
        retained.x + cardWidth / 2 - anchor.xPx,
        retained.y + cardHeight / 2 - anchor.yPx,
      ) < 440)
  ) {
    return {
      ...previous,
      width: cardWidth,
      height: cardHeight,
      overlapsAnchor: false,
      offscreen: false,
    };
  }
  const positions = compact
    ? [
        { x: margin, y: maxY },
        { x: margin, y: minY },
      ]
    : [
        { x: target.x + target.width + 20, y: anchor.yPx - cardHeight / 2 },
        { x: target.x - cardWidth - 20, y: anchor.yPx - cardHeight / 2 },
        { x: anchor.xPx - cardWidth / 2, y: target.y + target.height + 20 },
        { x: anchor.xPx - cardWidth / 2, y: target.y - cardHeight - 20 },
        { x: margin, y: minY },
        { x: maxX, y: maxY },
      ];
  const candidates = positions.map(clamp);
  const clear = candidates.find(
    (position) => !overlaps(position, target, 16) && clearsControls(position),
  );
  const candidate = clear ?? candidates.find(clearsControls) ?? candidates[0];
  return {
    ...candidate,
    overlapsAnchor: overlaps(candidate, target, 16),
    offscreen: false,
  };
}
