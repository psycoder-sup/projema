'use client';
/**
 * Account menu for the dense sidebar me-card (FR-04).
 * The trigger is the entire me-card; the dropdown contains the Sign out
 * action. Uses the `next-auth/react` client `signOut` — POSTs to
 * `/api/auth/signout` and then redirects to `/sign-in`.
 */
import { signOut } from 'next-auth/react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { DenseAvatar } from './DenseAvatar';
import { DenseIcon } from './IconSprite';

interface DenseAccountMenuProps {
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    role: 'admin' | 'member';
  };
  orgName: string;
}

export function DenseAccountMenu({ user, orgName }: DenseAccountMenuProps) {
  const label = user.displayName ?? user.email ?? 'You';
  const sub = user.email && user.displayName ? user.email : `${user.role} · ${orgName}`;

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button type="button" className="me-card" aria-label="Account menu">
          <DenseAvatar
            userId={user.id}
            displayName={user.displayName}
            email={user.email}
            size="md"
          />
          <div className="me-card-text">
            <div className="me-name">{label}</div>
            <div className="me-sub">
              {user.role} · {orgName}
            </div>
          </div>
          <DenseIcon id="i-chev" size={12} className="chev" />
        </button>
      </Dropdown.Trigger>

      <Dropdown.Portal>
        <Dropdown.Content
          side="top"
          align="start"
          sideOffset={8}
          className="dense-menu"
        >
          <div className="dense-menu-header">
            <div className="dense-menu-title">{label}</div>
            <div className="dense-menu-sub">{sub}</div>
          </div>
          <Dropdown.Separator className="dense-menu-sep" />
          <Dropdown.Item
            className="dense-menu-item"
            onSelect={() => {
              void signOut({ redirectTo: '/sign-in' });
            }}
          >
            Sign out
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
