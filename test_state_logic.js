
// Mock state
const initialState = {
    general: { name: "Andre" },
    nutrition: {
        meals: {
            breakfast: "Original Breakfast",
            lunch: "Original Lunch"
        },
        frequency: {
            cereals: "Daily"
        }
    }
};

// Proposed Helper Function
const updateNestedState = (prevState, path, value) => {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const newState = { ...prevState };

    let currentLevel = newState;
    for (const key of keys) {
        if (!currentLevel[key]) currentLevel[key] = {};
        currentLevel[key] = { ...currentLevel[key] }; // Inmutabilidad
        currentLevel = currentLevel[key];
    }
    currentLevel[lastKey] = value;
    return newState;
};

// Test Case 1: Update existing deep field
console.log("--- Test 1: Update nutrition.meals.breakfast ---");
const state1 = updateNestedState(initialState, "nutrition.meals.breakfast", "New Breakfast");
console.log("Updated Value:", state1.nutrition.meals.breakfast);
console.log("Preserved Sibling (Lunch):", state1.nutrition.meals.lunch);
console.log("Preserved Parent Sibling (Frequency):", state1.nutrition.frequency.cereals);

if (state1.nutrition.meals.breakfast === "New Breakfast" &&
    state1.nutrition.meals.lunch === "Original Lunch") {
    console.log("✅ PASS");
} else {
    console.log("❌ FAIL");
}

// Test Case 2: Add new deep field
console.log("\n--- Test 2: Add nutrition.meals.dinner ---");
const state2 = updateNestedState(state1, "nutrition.meals.dinner", "Light Dinner");
console.log("New Value:", state2.nutrition.meals.dinner);
console.log("Preserved Sibling (Breakfast):", state2.nutrition.meals.breakfast);

if (state2.nutrition.meals.dinner === "Light Dinner" &&
    state2.nutrition.meals.breakfast === "New Breakfast") {
    console.log("✅ PASS");
} else {
    console.log("❌ FAIL");
}

// Test Case 3: Update from Dashboard (Obj replacement)
console.log("\n--- Test 3: Dashboard Style Update (nutrition.frequency) ---");
// Dashboard sends the WHOLE object usually:
const newFrequencyObj = { ...state2.nutrition.frequency, cereals: "Weekly" };
const state3 = updateNestedState(state2, "nutrition.frequency", newFrequencyObj); // path is 2 levels

console.log("Updated Frequency:", state3.nutrition.frequency.cereals);
console.log("Preserved Meals:", state3.nutrition.meals.breakfast);

if (state3.nutrition.frequency.cereals === "Weekly" &&
    state3.nutrition.meals.breakfast === "New Breakfast") {
    console.log("✅ PASS");
} else {
    console.log("❌ FAIL");
}
