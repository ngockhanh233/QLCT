import Svg, { Path } from 'react-native-svg';

export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 16 16" fill={color}>
    <Path d="M0 3a2 2 0 0 1 2-2h13.5a.5.5 0 0 1 0 1H15v2a1 1 0 0 1 1 1v8.5a1.5 1.5 0 0 1-1.5 1.5h-12A2.5 2.5 0 0 1 0 12.5V3zm1 9.5A1.5 1.5 0 0 0 2.5 14h12a.5.5 0 0 0 .5-.5V5H2a1.98 1.98 0 0 1-.64-.107A1.5 1.5 0 0 0 1 6.5v6zM2 3a1 1 0 0 0 0 2h12V3H2z" />
  </Svg>
);
