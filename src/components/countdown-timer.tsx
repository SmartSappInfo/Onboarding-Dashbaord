"use client";

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
}

const CountdownTimer = ({ targetDate }: CountdownTimerProps) => {
  const calculateTimeLeft = () => {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0
    };

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set initial time on client to avoid hydration mismatch
    setTimeLeft(calculateTimeLeft());
    setIsClient(true);
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!isClient) {
    return <div className="grid grid-flow-col gap-5 text-center auto-cols-max justify-center animate-pulse">
        <div className="flex flex-col p-4 bg-primary/10 rounded-lg w-24 shadow-inner"><span className="font-mono text-5xl text-primary font-bold">--</span><span className="text-primary/80 uppercase text-sm">days</span></div>
        <div className="flex flex-col p-4 bg-primary/10 rounded-lg w-24 shadow-inner"><span className="font-mono text-5xl text-primary font-bold">--</span><span className="text-primary/80 uppercase text-sm">hours</span></div>
        <div className="flex flex-col p-4 bg-primary/10 rounded-lg w-24 shadow-inner"><span className="font-mono text-5xl text-primary font-bold">--</span><span className="text-primary/80 uppercase text-sm">min</span></div>
        <div className="flex flex-col p-4 bg-primary/10 rounded-lg w-24 shadow-inner"><span className="font-mono text-5xl text-primary font-bold">--</span><span className="text-primary/80 uppercase text-sm">sec</span></div>
      </div>
  }
  
  const timerComponents = Object.entries(timeLeft).map(([interval, value]) => {
    const paddedValue = String(value).padStart(2, '0');
    return (
      <div key={interval} className="flex flex-col p-4 bg-black/20 backdrop-blur-sm rounded-lg w-24 shadow-inner border border-white/10">
        <span className="font-mono text-5xl text-white font-bold">
          {paddedValue}
        </span>
        <span className="text-white/80 uppercase text-sm">{interval}</span>
      </div>
    );
  });

  return (
    <div className="grid grid-flow-col gap-5 text-center auto-cols-max justify-center">
      {Object.values(timeLeft).some(v => v > 0) ? timerComponents : <span className="text-2xl font-bold p-4 bg-black/20 rounded-lg">The meeting has started!</span>}
    </div>
  );
};

export default CountdownTimer;
