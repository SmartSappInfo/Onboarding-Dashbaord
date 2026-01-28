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

  const TimeBlock = ({ value, label }: { value: number, label: string }) => (
    <div className="flex flex-col items-center justify-center rounded-lg bg-white/10 p-4 backdrop-blur-sm w-24">
      <span className="font-mono text-4xl font-bold text-white sm:text-5xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-sm uppercase text-white/80">{label}</span>
    </div>
  );

  if (!isClient) {
    return (
      <div className="grid grid-cols-4 gap-2 sm:gap-5 justify-center">
        <TimeBlock value={0} label="days" />
        <TimeBlock value={0} label="hours" />
        <TimeBlock value={0} label="min" />
        <TimeBlock value={0} label="sec" />
      </div>
    )
  }
  
  if (Object.values(timeLeft).every(v => v === 0)) {
    return <div className="text-center text-2xl font-bold p-4 bg-white/20 text-white rounded-lg backdrop-blur-sm">The meeting has started!</div>
  }

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-5 justify-center">
      <TimeBlock value={timeLeft.days} label="days" />
      <TimeBlock value={timeLeft.hours} label="hours" />
      <TimeBlock value={timeLeft.minutes} label="min" />
      <TimeBlock value={timeLeft.seconds} label="sec" />
    </div>
  );
};

export default CountdownTimer;
