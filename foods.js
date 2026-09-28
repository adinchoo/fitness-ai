
// Favourite Malaysian foods database - v4 enhanced
const FOOD_DB = {
  Breakfast: [
    {name:"3 Boiled Eggs", kcal:223, protein:18, carbs:2, fat:15},
    {name:"Bubur Nasi + Ayam (1 bowl)", kcal:285, protein:13, carbs:35, fat:10},
    {name:"Nasi Lemak + Ayam Goreng + Telur", kcal:620, protein:28, carbs:55, fat:32},
    {name:"Roti Canai Kosong (1 pcs)", kcal:180, protein:4, carbs:22, fat:9},
    {name:"Tosai + Dhal", kcal:220, protein:6, carbs:30, fat:8},
    {name:"Overnight Oats + Protein", kcal:350, protein:25, carbs:45, fat:8},
  ],
  Main: [
    {name:"Nasi Kerabu + Daging Bakar + Telur Masin + Solok Lada + Ulam", kcal:775, protein:50, carbs:70, fat:28, variants:true},
    {name:"Nasi Kerabu + Ayam Bakar + Telur Masin + Solok Lada + Ulam", kcal:750, protein:50, carbs:68, fat:26, variants:true},
    {name:"Nasi Sup Perut Air Asam", kcal:500, protein:32, carbs:45, fat:18},
    {name:"Nasi Ayam Goreng + Kuah Gulai (sikit)", kcal:610, protein:32, carbs:60, fat:22},
    {name:"Nasi Budu + Ulam + Ikan Goreng", kcal:474, protein:26, carbs:50, fat:16},
    {name:"Nasi Putih + Ayam Bakar Madu + Ulam", kcal:530, protein:38, carbs:55, fat:14, variants:true},
    {name:"Nasi Putih + Ikan Bakar + Ulam", kcal:470, protein:35, carbs:48, fat:12},
    {name:"Nasi Goreng Kampung", kcal:550, protein:18, carbs:65, fat:20},
    {name:"Nasi Goreng Ayam", kcal:620, protein:30, carbs:68, fat:22},
    {name:"Chicken Rice (Nasi Ayam)", kcal:600, protein:30, carbs:65, fat:20},
  ],
  Protein: [
    {name:"Chicken Breast", sizes:{S:{kcal:165, protein:31, raw:"100g"}, M:{kcal:275, protein:51, raw:"165g"}, L:{kcal:380, protein:70, raw:"225g"}}},
    {name:"Salmon", sizes:{S:{kcal:180, protein:20, raw:"100g"}, M:{kcal:300, protein:34, raw:"165g"}, L:{kcal:410, protein:46, raw:"225g"}}},
    {name:"Beef Tenderloin", sizes:{S:{kcal:200, protein:26, raw:"100g"}, M:{kcal:330, protein:43, raw:"165g"}, L:{kcal:450, protein:59, raw:"225g"}}},
    {name:"Chicken Leg", sizes:{S:{kcal:180, protein:18, raw:"100g"}, M:{kcal:300, protein:30, raw:"165g"}, L:{kcal:410, protein:41, raw:"225g"}}},
    {name:"Ikan Kembung Bakar (1 ekor)", kcal:180, protein:22, carbs:0, fat:8},
    {name:"Telur Mata (1 biji)", kcal:90, protein:6, carbs:1, fat:7},
    {name:"Whey Protein + Water", kcal:120, protein:24, carbs:3, fat:1},
  ],
  Snack: [
    {name:"Konjac Jelly - Watermelon (1 pack)", kcal:6, protein:0},
    {name:"Konjac Jelly - Apple/Grape (1 pack)", kcal:6, protein:0},
    {name:"Konjac Jelly - Lychee/Peach (1 pack)", kcal:7, protein:0},
    {name:"Telur Rebus (1 egg)", kcal:78, protein:6},
    {name:"Tauhu Bakar (100g)", kcal:144, protein:10},
    {name:"Jagung Rebus (1 medium cob)", kcal:88, protein:3},
    {name:"Buah Oren (1 medium ~130g)", kcal:62, protein:1},
    {name:"Watermelon (1 slice ~150g)", kcal:46, protein:1},
    {name:"Greek Yogurt Fernleaf (100g)", kcal:80, protein:6},
    {name:"Epok-epok Sardine (1 pcs)", kcal:120, protein:4},
  ],
  Drink: [
    {name:"Coke Zero (1 can)", kcal:0, protein:0},
    {name:"Monster Ultra White (1 can 473ml)", kcal:10, protein:0},
    {name:"Air Kelapa (1 cup 240ml)", kcal:46, protein:0},
    {name:"Air Kosong", kcal:0, protein:0},
    {name:"Teh O Kosong", kcal:2, protein:0},
    {name:"Kopi O Kosong", kcal:4, protein:0},
    {name:"Protein Shake (1 scoop)", kcal:120, protein:24},
  ],
  Condiment: [
    {name:"Sambal Belacan - cooked (1 tbsp)", kcal:20, protein:1},
    {name:"Budu (1 tbsp ~15g)", kcal:15, protein:1},
    {name:"Maggi Cili Sos (1 tbsp ~15g)", kcal:27, protein:0},
  ]
};

const WORKOUT_TEMPLATES = {
  "Push Day": [
    {name:"Flat Bench Press (Smith Machine)", sets:3, reps:10, weight:0},
    {name:"Incline Press (Machine)", sets:3, reps:10, weight:0},
    {name:"Pec Deck Fly", sets:3, reps:10, weight:0},
    {name:"Cable Fly (Low to High)", sets:3, reps:10, weight:0},
    {name:"Tricep Pushdown", sets:3, reps:10, weight:0},
    {name:"Single Arm Tricep Pushdown", sets:3, reps:10, weight:0},
    {name:"Shoulder Press (Machine)", sets:3, reps:10, weight:0},
    {name:"Lateral Raise (Dumbbell)", sets:3, reps:12, weight:0},
  ],
  "Pull Day": [
    {name:"Lat Pulldown", sets:3, reps:10, weight:0},
    {name:"Seated Row", sets:3, reps:10, weight:0},
    {name:"Bent Over Row (Barbell)", sets:3, reps:10, weight:0},
    {name:"Face Pull", sets:3, reps:12, weight:0},
    {name:"Bicep Curl (Dumbbell)", sets:3, reps:12, weight:0},
    {name:"Hammer Curl", sets:3, reps:12, weight:0},
    {name:"Rear Delt Fly", sets:3, reps:12, weight:0},
  ],
  "Leg Day": [
    {name:"Squat (Smith Machine)", sets:3, reps:10, weight:0},
    {name:"Leg Press", sets:3, reps:10, weight:0},
    {name:"Romanian Deadlift", sets:3, reps:10, weight:0},
    {name:"Leg Extension", sets:3, reps:12, weight:0},
    {name:"Leg Curl", sets:3, reps:12, weight:0},
    {name:"Calf Raise", sets:3, reps:15, weight:0},
    {name:"Hip Thrust", sets:3, reps:10, weight:0},
  ],
  "Full Body": [
    {name:"Squat", sets:3, reps:10, weight:0},
    {name:"Bench Press", sets:3, reps:10, weight:0},
    {name:"Lat Pulldown", sets:3, reps:10, weight:0},
    {name:"Shoulder Press", sets:3, reps:10, weight:0},
    {name:"Plank (seconds)", sets:3, reps:60, weight:0},
  ],
  "Garmin Run": [
    {name:"Warmup Walk 5min", sets:1, reps:5, weight:0},
    {name:"Easy Run", sets:1, reps:30, weight:0},
    {name:"Cooldown Walk", sets:1, reps:5, weight:0},
  ]
};
