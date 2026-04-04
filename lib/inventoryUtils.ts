export type Unit = {
  name: string;
  multiplier: number;
};

export type WarehouseInput = {
  name?: string;
  quantity: number | string;
  selectedUnit: string;
};

/**
 * 1. Calculate the total quantity in the base unit across all warehouses.
 * This is the number you should save to Firebase.
 */
export function calculateTotalBaseQuantity(warehouses: WarehouseInput[], units: Unit[]): number {
  if (!warehouses || !Array.isArray(warehouses)) return 0;
  if (!units || !Array.isArray(units)) return 0;

  return warehouses.reduce((total, warehouse) => {
    // Ensure quantity is a valid number
    const qty = Number(warehouse.quantity) || 0;
    
    // Find the corresponding unit in the units array
    const matchedUnit = units.find(u => u.name === warehouse.selectedUnit);
    
    // If unit is found, multiply by its multiplier; otherwise, default to 1
    const multiplier = matchedUnit?.multiplier || 1;
    
    return total + (qty * multiplier);
  }, 0);
}

/**
 * 2. Format the total base quantity into a readable string for the UI.
 * e.g., "10 علبة و 4 قطعة (144 قطعة كلياً)"
 */
export function formatDisplayQuantity(totalBaseQuantity: number, units: Unit[]): string {
  // If there are no units or total is 0, return a safe default
  if (!units || units.length === 0) return `${totalBaseQuantity}`;
  if (totalBaseQuantity === 0) {
    const defaultBase = units.find(u => u.multiplier === 1)?.name || '';
    return `0 ${defaultBase}`.trim();
  }

  // Find the base unit (multiplier === 1) and the largest unit (max multiplier)
  let baseUnit = units[0];
  let largestUnit = units[0];

  units.forEach(unit => {
    if (unit.multiplier === 1) baseUnit = unit;
    if (unit.multiplier > largestUnit.multiplier) largestUnit = unit;
  });

  // If there is no larger unit (i.e., we only have base units configured)
  if (largestUnit.multiplier === 1) {
    return `${totalBaseQuantity} ${baseUnit.name}`;
  }

  // Calculate quantities
  const largestUnitCount = Math.floor(totalBaseQuantity / largestUnit.multiplier);
  const remainingBaseCount = totalBaseQuantity % largestUnit.multiplier;

  // Build the display string
  const displayParts: string[] = [];

  if (largestUnitCount > 0) {
    displayParts.push(`${largestUnitCount} ${largestUnit.name}`);
  }

  if (remainingBaseCount > 0) {
    displayParts.push(`${remainingBaseCount} ${baseUnit.name}`);
  }

  const formattedString = displayParts.join(' و ');

  // Append the total note only if we actually used the largest unit in the string
  if (largestUnitCount > 0) {
    return `${formattedString} (${totalBaseQuantity} ${baseUnit.name} كلياً)`;
  }

  return formattedString;
}

/**
 * 3. Calculate independent equivalent stock for each unit type based on total base quantity.
 * e.g., ["4 كونية", "4 كيس", "36 كيلو"]
 */
export function getInventoryBalances(totalBaseQuantity: number, units: Unit[]): string[] {
  if (!units || units.length === 0) return [];
  if (totalBaseQuantity === 0) return [`0 ${units[0].name}`];

  const absoluteMultipliers: number[] = [];
  let runningMultiplier = 1;

  for (let i = 0; i < units.length; i++) {
    if (i === 0) {
      absoluteMultipliers.push(1);
    } else {
      runningMultiplier = runningMultiplier * (units[i].multiplier || 1);
      absoluteMultipliers.push(runningMultiplier);
    }
  }

  const balances: string[] = [];
  
  for (let i = units.length - 1; i >= 0; i--) {
    const absMultiplier = absoluteMultipliers[i];
    const equivalentQty = totalBaseQuantity / absMultiplier;
    const formattedQty = parseFloat(equivalentQty.toFixed(2));
    balances.push(`${formattedQty} ${units[i].name}`);
  }

  return balances;
}
