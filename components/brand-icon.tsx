import Image from "next/image";

export function BrandIcon({
  size = 30,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand.jpg"
        alt="TenderPilot"
        fill
        className="object-cover"
        priority
      />
    </span>
  );
}
