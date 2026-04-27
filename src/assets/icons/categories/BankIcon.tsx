import Svg, { Path } from 'react-native-svg';

// Bootstrap Icons: bank
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 16 16" fill={color}>
    <Path d="M8 0 1 4v1h14V4L8 0ZM3 6v7h1V6H3Zm3 0v7h1V6H6Zm3 0v7h1V6H9Zm3 0v7h1V6h-1ZM2 14a1 1 0 0 0-1 1v.5a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V15a1 1 0 0 0-1-1H2Z" />
  </Svg>
);
