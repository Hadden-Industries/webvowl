const tools = {};
module.exports = function (){
  return tools;
};

tools.distanceToBorder = function ( rect, dx, dy ){
  const width = rect.width(),
    height = rect.height();

  let innerDistance;
  const m_link = Math.abs(dy / dx);
  const m_rect = height / width;

  if ( m_link <= m_rect ) {
    const timesX = dx / (width / 2),
      rectY = dy / timesX;
    innerDistance = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(rectY, 2));
  } else {
    const timesY = dy / (height / 2),
      rectX = dx / timesY;
    innerDistance = Math.sqrt(Math.pow(height / 2, 2) + Math.pow(rectX, 2));
  }

  return innerDistance;
};
