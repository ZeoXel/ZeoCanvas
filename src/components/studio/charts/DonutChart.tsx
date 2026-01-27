"use client";

import React, { useRef, useEffect } from 'react';

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 160,
  thickness = 28
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = (size - thickness) / 2;

    // 清除画布
    ctx.clearRect(0, 0, size, size);

    // 计算总值
    const total = data.reduce((sum, item) => sum + item.value, 0);

    // 绘制环形图
    let currentAngle = -Math.PI / 2; // 从顶部开始

    data.forEach((segment) => {
      const segmentAngle = (segment.value / total) * Math.PI * 2;

      // 绘制弧段
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + segmentAngle);
      ctx.lineWidth = thickness;
      ctx.strokeStyle = segment.color;
      ctx.lineCap = 'round';
      ctx.stroke();

      currentAngle += segmentAngle;
    });

    // 绘制中心白色圆（形成环形效果已经由lineWidth控制）
    // 可选：添加中心文字
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${total.toFixed(0)}`, centerX, centerY - 8);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('总消耗', centerX, centerY + 8);

  }, [data, size, thickness]);

  return (
    <div className="flex items-center justify-center">
      <canvas
        ref={canvasRef}
        style={{ width: `${size}px`, height: `${size}px` }}
        className="rounded-lg"
      />
    </div>
  );
};
