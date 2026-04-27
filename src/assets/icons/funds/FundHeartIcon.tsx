import Svg, { Path } from 'react-native-svg';

// Bootstrap Icons: heart-fill — Cưới hỏi / Yêu thương
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 16 16" fill={color}>
    <Path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314" />
  </Svg>
);
