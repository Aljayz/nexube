import { useEffect, useState } from 'react';

function SplashScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center flex-1 bg-background">
      <div className="animate-fade-in flex flex-col items-center">
        <img
          src="/Logo+Name.png"
          alt="Nexube"
          className="w-64 h-64 mb-xl animate-pulse-slow"
        />
        <div className="w-48 h-1 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-md text-text-muted text-sm">Loading Nexube...</p>
      </div>
    </div>
  );
}

export default SplashScreen;
