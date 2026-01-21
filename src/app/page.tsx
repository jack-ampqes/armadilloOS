import Link from "next/link";
import Image from "next/image";
import { 
  ShoppingCart, 
  Box, 
  Handshake, 
  Tags, 
  Warehouse,
  CirclePile,
  FileText,
} from "lucide-react";

export default function Dashboard() {
  const sections = [
    {
      title: "Orders",
      description: "Create, view, and process customer orders",
      href: "/orders",
      icon: ShoppingCart
    },
    {
      title: "Quotes",
      description: "Create and manage customer quotes",
      href: "/quotes",
      icon: FileText
    },
    {
      title: "Inventory",
      description: "Track and manage product inventory",
      href: "/inventory",
      icon: CirclePile
    },
    {
      title: "Customers",
      description: "Manage customer information and contacts",
      href: "/customers",
      icon: Handshake
    },
    {
      title: "Sales Reps",
      description: "Manage sales representatives",
      href: "/sales-reps",
      icon: Tags
    },
    {
      title: "Distributors",
      description: "Manage distributors and partnerships",
      href: "/distributors",
      icon: Warehouse
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">
            Dashboard
          </h1>
        </div>

      {/* Banner */}
      <div className="w-full flex justify-center">
        <Image
          src="/armadilloCartoonBanner.png"
          alt="Armadillo Cartoon Banner"
          width={1200}
          height={100}
          className="max-w-[75%] h-auto rounded-lg"
          priority
        />
      </div>

      {/* Sections List */}
      <div className="space-y-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.title}
              href={section.href}
              className="block group"
            >
              <div className="relative flex items-center gap-4 py-8 px-5 border border-white/20 rounded-lg hover:border-white/30 transition-colors overflow-hidden bg-[#181818]">
                <div className="absolute top-0 left-0 w-0 h-full bg-white/10 group-hover:w-[120%] group-hover:bg-white/15 transition-all duration-[400ms] ease-in-out"></div>
                <Icon className="w-6 h-6 text-white relative z-10" />
                <div className="relative z-10">
                  <h3 className="text-xl font-semibold text-white">
                    {section.title}
                  </h3>
                  <p className="text-white text-sm mt-1">
                    {section.description}
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 translate-x-full group-hover:translate-x-0 transition-transform duration-[200ms] ease-in-out z-20 flex items-end">
                  <Image
                    src="/JustHead.png"
                    alt="Armadillo Head"
                    width={150}
                    height={150}
                    style={{ opacity: 0.5 }}
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
