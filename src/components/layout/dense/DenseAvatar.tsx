import { avatarBucket, initialsFor } from './utils';

interface DenseAvatarProps {
  userId?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: 'sm' | 'md' | 'lg';
  bucket?: number;
}

export function DenseAvatar({
  userId,
  displayName,
  email,
  size = 'md',
  bucket,
}: DenseAvatarProps) {
  const c = bucket ?? avatarBucket(userId ?? displayName ?? email ?? null);
  const label = displayName ?? email ?? null;
  return (
    <div
      className={`avatar ${size}`}
      data-c={c}
      role="img"
      aria-label={label ?? 'Unknown user'}
      aria-hidden={label === null ? true : undefined}
      title={label ?? undefined}
    >
      {initialsFor(displayName, email)}
    </div>
  );
}
