/**
 * Random Name Generator for Agents
 * Generates friendly, memorable names for AI agents
 */
const firstNames = [
    // Classic names
    'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry',
    'Iris', 'Jack', 'Kate', 'Leo', 'Maya', 'Noah', 'Olivia', 'Paul',
    'Quinn', 'Ruby', 'Sam', 'Tara', 'Uma', 'Victor', 'Wendy', 'Xander',
    'Yara', 'Zoe',
    // Modern names
    'Aria', 'Blake', 'Chloe', 'Dylan', 'Emma', 'Felix', 'Hazel', 'Isaac',
    'Luna', 'Max', 'Nova', 'Oscar', 'Piper', 'River', 'Sage', 'Theo',
    // Tech-inspired names
    'Ada', 'Alan', 'Grace', 'Linus', 'Marie', 'Tesla', 'Turing', 'Vim',
    'Bash', 'Root', 'Sudo', 'Echo', 'Node', 'React', 'Vue', 'Go'
];
const lastNames = [
    // Professional surnames
    'Anderson', 'Brown', 'Clark', 'Davis', 'Evans', 'Foster', 'Green', 'Harris',
    'Jackson', 'Johnson', 'King', 'Lewis', 'Miller', 'Nelson', 'Parker', 'Quinn',
    'Roberts', 'Smith', 'Taylor', 'Turner', 'Walker', 'White', 'Wilson', 'Young',
    // Tech-inspired surnames
    'Code', 'Debug', 'Script', 'Binary', 'Logic', 'Syntax', 'Runtime', 'Kernel',
    'Parser', 'Compiler', 'Function', 'Variable', 'Algorithm', 'Protocol', 'Framework',
    'Database', 'Network', 'Server', 'Client', 'Terminal', 'Console', 'Process'
];
/**
 * Generate a random full name for an agent
 */
export function generateAgentName() {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${firstName} ${lastName}`;
}
/**
 * Generate multiple unique agent names
 */
export function generateUniqueAgentNames(count) {
    const names = new Set();
    let attempts = 0;
    const maxAttempts = count * 10; // Prevent infinite loop
    while (names.size < count && attempts < maxAttempts) {
        names.add(generateAgentName());
        attempts++;
    }
    return Array.from(names);
}
/**
 * Get a deterministic name based on agent ID (for consistency)
 */
export function getConsistentAgentName(agentId) {
    // Use agent ID to seed the random selection for consistency
    const hash = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const firstIndex = hash % firstNames.length;
    const lastIndex = Math.floor(hash / firstNames.length) % lastNames.length;
    return `${firstNames[firstIndex]} ${lastNames[lastIndex]}`;
}
