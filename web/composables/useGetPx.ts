export const PX_PER_M = 500;

export default function () {
  return (value: number) => `${value * PX_PER_M}px`;
}
