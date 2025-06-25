
interface EmptyStateProps {
  title: string;
  description: string;
}

export const EmptyState = ({ title, description }: EmptyStateProps) => {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">
          {title}
        </h2>
        <p className="text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
};
