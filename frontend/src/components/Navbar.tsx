import { NavLink } from "react-router";
import { ROUTES } from "../constants/routes";
import { WalletButton } from "./wallet-button";

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center w-full mb-10">
      <div className="flex gap-4">
        {ROUTES.map((route) => (
          <NavLink
            to={route.to}
            className={({ isActive }) => (isActive ? " text-gray-600" : "")}
            key={route.label}
          >
            {route.label}
          </NavLink>
        ))}
      </div>
      <NavLink to="/">GitHub</NavLink>
      <div className="flex gap-1">
        <WalletButton>Connect Wallet</WalletButton>
      </div>
    </nav>
  );
}
