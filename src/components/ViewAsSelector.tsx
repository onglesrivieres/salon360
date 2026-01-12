import { useState, useRef, useEffect } from 'react';
import { Eye, ChevronDown, Check } from 'lucide-react';
import { Role } from '../lib/permissions';

interface ViewAsSelectorProps {
  currentRole: Role | null;
  onSelectRole: (role: Role) => void;
  isViewingAs: boolean;
}

const ALL_ROLES: Role[] = [
  'Admin',
  'Owner',
  'Manager',
  'Supervisor',
  'Receptionist',
  'Technician',
  'Cashier'
];

export function ViewAsSelector({ currentRole, onSelectRole, isViewingAs }: ViewAsSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectRole = (role: Role) => {
    onSelectRole(role);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isViewingAs
            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-2 border-amber-400'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        title="View as different role"
      >
        <Eye className="w-4 h-4" />
        <span className="hidden md:inline">View as</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] z-50">
          <div className="px-3 py-2 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase">Select Role</p>
          </div>
          {ALL_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => handleSelectRole(role)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                currentRole === role ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              <span>{role}</span>
              {currentRole === role && <Check className="w-4 h-4 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
