import './css/style.css';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1200;
canvas.height = 800;

ctx.fillStyle = '#0a0a2e';
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.fillStyle = '#ffffff';
ctx.font = '36px Arial';
ctx.textAlign = 'center';
ctx.fillText('Hello Gravity Shooter', canvas.width / 2, canvas.height / 2);

ctx.font = '16px Arial';
ctx.fillText('Phase 1 — Build chain verified', canvas.width / 2, canvas.height / 2 + 40);
