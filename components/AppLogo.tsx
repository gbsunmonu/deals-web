"use client";

import Link from "next/link";
import Image from "next/image";

export default function AppLogo() {
  return (
    <Link href="/" className="flex items-center gap-2 select-none">
      <div className="relative h-9 w-9">
        <Image
          src="/dealina-logo.svg"   // <- uses the file you just created
          alt="Dealina logo"
          fill
          className="object-contain"
          priority
        />
      </div>

      <span className="text-lg font-semibold tracking-tight text-gray-900">
        Dealina
      </span>
    </Link>
  );
}
