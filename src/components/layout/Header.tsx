"use client";

import { Car } from "lucide-react";
import { ModeToggle } from "@/components/theme/ModeToggle";
import { Button } from "../ui/button";
import { Link } from "react-router-dom";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <Car className="h-6 w-6" />
          <span className="ml-2 font-bold">M&H Auto Parts</span>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center space-x-4">
            <Link to="/vehicles">
              <Button variant="ghost">Inventory</Button>
            </Link>
            <Link to="/login">
              <Button>Staff Login</Button>
            </Link>
          </nav>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}