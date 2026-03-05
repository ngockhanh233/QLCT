import Svg, { Path, Circle } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  color?: string;
};

const PetIcon = ({ width = 24, height = 24, color = '#000' }: Props) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    {/* Ears */}
    <Path
      d="M6 7L5 4.5L7.5 3.5L9 5.5"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M18 7L19 4.5L16.5 3.5L15 5.5"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Face outline */}
    <Path
      d="M7 8.5C7 6.567 8.567 5 10.5 5H13.5C15.433 5 17 6.567 17 8.5V11.5C17 14.538 14.538 17 11.5 17C8.462 17 6 14.538 6 11.5V9.5"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Eyes */}
    <Circle cx={9.5} cy={10.5} r={0.9} fill={color} />
    <Circle cx={13.5} cy={10.5} r={0.9} fill={color} />
    {/* Nose and mouth */}
    <Path
      d="M11.5 11.5L10.7 12.3C10.3 12.7 10.5858 13.4 11.1464 13.4H11.8536C12.4142 13.4 12.7 12.7 12.3 12.3L11.5 11.5Z"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M10.2 14.2C10.6 14.5 11.03 14.65 11.5 14.65C11.97 14.65 12.4 14.5 12.8 14.2"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
    />
  </Svg>
);

export default PetIcon;

