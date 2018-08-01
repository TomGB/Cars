const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const carImage = new Image();
carImage.src = "./car.svg";
const road = new Image();
road.src = "./road.jpg";

const cfg = {
    NUM_CARS: 20,

    CAR_WIDTH: 24,
    CAR_LENGTH: 55,
    CAR_LENGTH_FRONT_OFFSET: 40,

    CAR_TURN_RATE: 0.015,

    PLAYER_ACC: 0.008,
    PC_ACC: 0.005,

    DRAG_CO: 200,
};

cfg.CAR_LENGTH_REAR_OFFSET = cfg.CAR_LENGTH - cfg.CAR_LENGTH_FRONT_OFFSET;
cfg.CAR_HALF_WIDTH = cfg.CAR_WIDTH / 2;

Object.freeze(cfg);

// Cars Setup

const PlayerCar = {
    pos: {
        x: 400, y: 400, rot: Math.PI/2,
    },
    vel: 0,
    acc: 0,
}

const cars = new Array(cfg.NUM_CARS).fill().map((_, i) => ({
    pos: {
        x: i * 50 + 100, y: 200, rot: Math.PI,
    },
    vel: 0,
    acc: 0,
}));

// keyboard Controls

const Actions = [
    ['a', 'left'],
    ['d', 'right'],
    ['w', 'up'],
    ['s', 'down'],
].map(([key, action]) => ({ key, action, on: false }));

const setActionByKey = (inKey, state) => {
    const action = Actions.find(({ key }) => key === inKey)
    if (action) action.on = state;
}

const getActionStates = () =>
    Actions.reduce((acc, { action, on }) => {
        acc[action] = on;
        return acc;
    }, {});

const keyListener = state => ({ key }) => setActionByKey(key, state);
document.addEventListener('keydown', keyListener(true))
document.addEventListener('keyup', keyListener(false))

// Collision Code

const vecFromRotVeg = (x, y, rot) => (x * Math.cos(rot) + y * Math.sin(rot))

const generateCollisionBox = (car) => {
    const { pos: { x, y, rot } } = car;
    const br = {
        x: x + vecFromRotVeg(cfg.CAR_HALF_WIDTH, -cfg.CAR_LENGTH_REAR_OFFSET, rot),
        y: y + vecFromRotVeg(cfg.CAR_LENGTH_REAR_OFFSET, cfg.CAR_HALF_WIDTH, rot),
    };
    const bl = {
        x: x + vecFromRotVeg(-cfg.CAR_HALF_WIDTH, -cfg.CAR_LENGTH_REAR_OFFSET, rot),
        y: y + vecFromRotVeg(cfg.CAR_LENGTH_REAR_OFFSET, -cfg.CAR_HALF_WIDTH, rot),
    };
    const fl = {
        x: x + vecFromRotVeg(-cfg.CAR_HALF_WIDTH, cfg.CAR_LENGTH_FRONT_OFFSET, rot),
        y: y + vecFromRotVeg(-cfg.CAR_LENGTH_FRONT_OFFSET, -cfg.CAR_HALF_WIDTH, rot),
    };
    const fr = {
        x: x + vecFromRotVeg(cfg.CAR_HALF_WIDTH, cfg.CAR_LENGTH_FRONT_OFFSET, rot),
        y: y + vecFromRotVeg(-cfg.CAR_LENGTH_FRONT_OFFSET, cfg.CAR_HALF_WIDTH, rot),
    };
    car.frontLine = { p1: fl, p2: fr };
    car.leftLine = { p1: fl, p2: bl };
    car.rightLine = { p1: fr, p2: br };
    car.backLine = { p1: br, p2: bl };
};

const linesIntersect = ({
    p1: { x: a, y: b },
    p2: { x: c, y: d },
}, {
    p1: { x: p, y: q },
    p2: { x: r, y: s },
}) => {
    const det = (c - a) * (s - q) - (r - p) * (d - b);

    if (det === 0) return false;

    const lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
    const gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
};

const hit = ({
    frontLine,
    backLine,
    leftLine,
    rightLine,
}, {
    frontLine: frontLine2,
    backLine: backLine2,
    leftLine: leftLine2,
    rightLine: rightLine2,
}) => (
    linesIntersect(frontLine, frontLine2) ||
    linesIntersect(frontLine, leftLine2) ||
    linesIntersect(frontLine, rightLine2) ||
    linesIntersect(frontLine, backLine2) ||
    
    linesIntersect(leftLine, frontLine2) ||
    linesIntersect(leftLine, leftLine2) ||
    linesIntersect(leftLine, rightLine2) ||
    linesIntersect(leftLine, backLine2) ||
    
    linesIntersect(rightLine, frontLine2) ||
    linesIntersect(rightLine, leftLine2) ||
    linesIntersect(rightLine, rightLine2) ||
    linesIntersect(rightLine, backLine2) ||
    
    linesIntersect(backLine, frontLine2) ||
    linesIntersect(backLine, leftLine2) ||
    linesIntersect(backLine, rightLine2) ||
    linesIntersect(backLine, backLine2)
)

const runCollisions = () => {
    generateCollisionBox(PlayerCar);
    generateCollisionBox(cars[0]);

    if (hit(PlayerCar, cars[0])) {
        console.log('hit');
    }
}

// Calculate Input Code

const distance = (p1, p2) => {
    const a = p1.x - p2.x;
    const b = p1.y - p2.y;
    return Math.sqrt( a*a + b*b );
}

const constrainAngle = angle => {
    let constrainedAngle = angle;
    if (angle > Math.PI) constrainedAngle-= Math.PI*2;
    if (angle < -Math.PI) constrainedAngle+= Math.PI*2;
    return constrainedAngle;
}

const getAngleBetweenCars = (p1, p2) => {
    const angleBasedRight = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const northAngle = constrainAngle(angleBasedRight + Math.PI/2);
    return constrainAngle(northAngle - p1.rot); // angle to player
}

const getInput = ({ thisCar, followCar }) => {
    const angle = getAngleBetweenCars(thisCar.pos, followCar.pos);
    const distBetweenCars = distance(followCar.pos, thisCar.pos);
    const tooClose = (distBetweenCars < 100);

    return {
        up: !tooClose,
        down: tooClose,
        left: (angle < 0),
        right: (angle > 0)
    };
}

// Draw Code

const drawCar = (car) => {
    ctx.save();
    ctx.translate(car.pos.x, car.pos.y);
    ctx.rotate(car.pos.rot);  // rotate 90 degrees
    ctx.fillStyle = "red";
    ctx.drawImage(carImage, -cfg.CAR_HALF_WIDTH, -cfg.CAR_LENGTH_FRONT_OFFSET, cfg.CAR_WIDTH, cfg.CAR_LENGTH);
    ctx.restore();
}

const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = "white";
    ctx.fillRect(0,0,800,800);

    ctx.translate(- PlayerCar.pos.x + 400, - PlayerCar.pos.y + 400);

    for (let i = 0; i < 100; i++) {
        ctx.drawImage(road, i * 200, 0, 200, 200);
        
    }

    drawCar(PlayerCar);

    cars.forEach(drawCar);
}

// Movement Physics

const moveCar = (car, { up, down, left, right }, user) => {
    car.acc = 0;
    if (up) car.acc = user ? cfg.PLAYER_ACC : cfg.PC_ACC;
    if (down && car.vel > 0) car.acc = -0.01;

    const drag = car.vel / cfg.DRAG_CO;
    car.acc -= drag;
    car.vel += car.acc;

    const dRot = (right && cfg.CAR_TURN_RATE) - (left && cfg.CAR_TURN_RATE);
    const nerfedRot = dRot * car.vel;
    car.pos.rot = constrainAngle(car.pos.rot + nerfedRot);

    car.pos.x += car.vel * Math.sin(car.pos.rot);
    car.pos.y -= car.vel * Math.cos(car.pos.rot);
}

// Game Logic

const loop = () => {
    moveCar(PlayerCar, getActionStates(), 'user');
    moveCar(cars[0], getInput({ thisCar: cars[0], followCar: PlayerCar }));

    cars.slice(1).forEach((thisCar, index) => {
        const followCar = cars[index];
        moveCar(thisCar, getInput({ thisCar, followCar }));
    });

    runCollisions();

    draw();
}

setInterval(loop, 1);