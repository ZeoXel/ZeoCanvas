"use client";

import React, { useRef, useEffect } from 'react';

interface DataPoint {
  date: string;
  value: number;
}

interface TrendChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  height = 120,
  color = '#3b82f6'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);

    const width = rect.width;
    const chartHeight = rect.height;

    const padding = { top: 10, right: 10, bottom: 20, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    // 清除画布
    ctx.clearRect(0, 0, width, chartHeight);

    // 计算数据范围
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const valueRange = maxValue - minValue || 1;

    // 绘制网格线
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (innerHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
    }

    // 计算点的位置
    const points = data.map((d, i) => {
      const x = padding.left + (chartWidth / (data.length - 1)) * i;
      const normalizedValue = (d.value - minValue) / valueRange;
      const y = padding.top + innerHeight - (normalizedValue * innerHeight);
      return { x, y, value: d.value };
    });

    // 绘制渐变填充区域
    const gradient = ctx.createLinearGradient(0, padding.top, 0, chartHeight - padding.bottom);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '00');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(points[0].x, chartHeight - padding.bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, chartHeight - padding.bottom);
    ctx.closePath();
    ctx.fill();

    // 绘制线条
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // 绘制点
    points.forEach(p => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

  }, [data, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${height}px` }}
      className="rounded-lg"
    />
  );
};
