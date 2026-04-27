import Svg, { Path } from 'react-native-svg';

// Bootstrap Icons: person-dress (Wife — phụ nữ).
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 16 16" fill={color}>
    <Path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5.5 9a.5.5 0 0 0-.485.379L3.515 15.121a.5.5 0 0 0 .485.621H6v3.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3.5h2a.5.5 0 0 0 .485-.621L10.985 9.379A.5.5 0 0 0 10.5 9h-5Z" />
  </Svg>
);
