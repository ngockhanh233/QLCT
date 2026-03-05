import Svg, { Path } from 'react-native-svg';

export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 16 16" fill={color}>
    <Path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5zM6.374 1l-2.06 7H7.5a.5.5 0 0 1 .478.647L6.89 11.884 12.5 7H8.5a.5.5 0 0 1-.474-.658L9.306 1H6.374z" />
  </Svg>
);
