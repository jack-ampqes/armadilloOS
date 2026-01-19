import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <Image
        src="/tiredguy.png"
        alt="Tired armadillo working on laptop"
        width={600}
        height={600}
        className="max-w-full h-auto mb-6"
        priority
      />
      <p className="text-black text-lg text-center">
        oops you discovered a page that doesn't exist yet (it's my breakroom)
      </p>
    </div>
  );
}
