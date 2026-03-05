import Svg, { Path } from 'react-native-svg';

export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 16 16" fill={color}>
    <Path d="M2 2a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1h.5A1.5 1.5 0 0 1 15 4.5v.5a2.5 2.5 0 0 1-2.5 2.5H12v5.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 4 13V2zm9 0H3v11a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5V2h2zm1 4h.5a1.5 1.5 0 0 0 1.5-1.5V4a.5.5 0 0 0-.5-.5H12V6z" />
  </Svg>
);
