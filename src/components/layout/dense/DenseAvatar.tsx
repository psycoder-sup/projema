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
  return (
    <div
      className={`avatar ${size}`}
      data-c={c}
      title={displayName ?? email ?? undefined}
      aria-hidden={!displayName}
    >
      {initialsFor(displayName, email)}
    </div>
  );
}
