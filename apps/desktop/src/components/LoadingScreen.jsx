import SplashScreen from './SplashScreen';

function LoadingScreen({ message = 'Loading Nexube...' }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <div className="animate-fade-in flex flex-col items-center">
        <img
          src="/Logo+Name.png"
          alt="Nexube"
          className="w-64 h-64 mb-xl animate-pulse-slow"
        />
        {/* <div className="w-48 h-1 bg-surface rounded-full overflow-hidden">
          <div className="h-full bg-accent animate-pulse" style={{ width: '100%' }} />
        </div> */}
        <p className="mt-md text-text-muted text-sm">{message}</p>
      </div>
    </div>
  );
}

export default LoadingScreen;
