import Svg, { Path } from 'react-native-svg';

export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 16 16" fill={color}>
    <Path d="M2 6a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0V6zm2-1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1V5H4zm9 1a1 1 0 1 0 2 0v4a1 1 0 1 0-2 0V6zm-1-1a1 1 0 0 0 1 1v4a1 1 0 0 0-1 1h-1V5h1zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 1a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z" />
  </Svg>
);
