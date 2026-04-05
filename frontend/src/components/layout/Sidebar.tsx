import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Modellezés' },
  { to: '/torteneti', label: 'Történeti' },
  { to: '/kutatasok', label: 'Kutatások' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex-shrink-0">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
