import { cn } from "@/lib/utils";

export const PageSectionHeader = ({
  title,
  titleComponent,
  endContent,
  isOnboarding = false,
  addButton,
  className,
  classNames,
  menuComponent,
  isSecondary = false,
}: {
  title?: string;
  titleComponent?: React.ReactNode;
  endContent?: React.ReactNode;
  isOnboarding?: boolean;
  addButton?: React.ReactNode;
  className?: string;
  classNames?: {
    title?: string;
  };
  menuComponent?: React.ReactNode;
  isSecondary?: boolean;
}) => {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 border-y bg-stone-100 pl-10 pr-7 h-10 flex justify-between items-center",
        isOnboarding && "px-2",
        menuComponent && "pr-0",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {title && (
          <h2
            className={cn(
              "text-sm text-t2 font-medium",
              classNames?.title,
              isSecondary && "text-sm"
            )}
          >
            {title}
          </h2>
        )}
        {titleComponent}
      </div>
      <div className="flex items-center min-w-20 justify-end h-full">
        {endContent}
        {addButton && (
          <div className="flex items-center w-full">{addButton}</div>
        )}
        {menuComponent && (
          <div className="flex items-center">{menuComponent}</div>
        )}
      </div>
    </div>
  );
};
