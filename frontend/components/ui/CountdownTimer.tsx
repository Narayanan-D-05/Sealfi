"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  targetDate: number;
  onExpire?: () => void;
}

export function CountdownTimer({ targetDate, onExpire }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = targetDate - now;

      if (diff <= 0) {
        onExpire?.();
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(diff / 86400),
        hours: Math.floor((diff % 86400) / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onExpire]);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <span className="font-mono text-sm">
      {timeLeft.days > 0 && `${timeLeft.days}d `}
      {pad(timeLeft.hours)}h {pad(timeLeft.minutes)}m {pad(timeLeft.seconds)}s
    </span>
  );
}
