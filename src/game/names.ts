import { choice } from "./random";
import type { Gender } from "./types";

// ═════════════════════════════════════════════════════════════
// names.ts — names for invented actors and directors.
// Each region has its own first names and surnames, so a name always sounds like it comes from
// one place ("Chidi Okonkwo", "Saoirse Gallagher"). `weight` is how common the region is in the talent pool.
// Add a region or extend a list freely; nothing else needs to change.
// ═════════════════════════════════════════════════════════════

type Region = { id: string; weight: number; female: string[]; male: string[]; last: string[] };

const REGIONS: Region[] = [
	{
		id: "anglo", weight: 11,
		female: ["Emma", "Olivia", "Charlotte", "Hannah", "Grace", "Megan", "Harper", "Ruby", "Alice", "Eleanor", "Florence", "Natalie", "Brooke", "Tessa", "Willa", "Margot", "Piper", "Daisy", "Lydia", "Rosalind"],
		male: ["James", "Oliver", "Henry", "Jack", "Ethan", "Theo", "Owen", "Caleb", "Miles", "Harrison", "Declan", "Warren", "Graham", "Dominic", "Nolan", "Spencer", "Reid", "Julian", "Preston", "Elliot"],
		last: ["Whitfield", "Carter", "Hayes", "Brooks", "Sullivan", "Fletcher", "Harlow", "Mercer", "Ashworth", "Bennett", "Kingsley", "Calloway", "Thornton", "Prescott", "Waverly", "Donovan", "Sinclair", "Blackwood", "Hargrove", "Lockhart", "Pemberton", "Stanton", "Greer", "Holloway"],
	},
	{
		id: "irish", weight: 3,
		female: ["Saoirse", "Aoife", "Niamh", "Siobhán", "Roisin", "Maeve", "Caoimhe", "Orla", "Sinéad", "Fiona", "Clodagh", "Eimear"],
		male: ["Cillian", "Ciarán", "Fionn", "Declan", "Oisín", "Cormac", "Eoin", "Rory", "Colm", "Darragh", "Tadhg", "Niall"],
		last: ["Gallagher", "Brennan", "Doherty", "Fitzgerald", "Kavanagh", "Murphy", "Quinn", "Delaney", "O'Connell", "Byrne", "Donnelly", "McCarthy", "Rooney", "Sheridan"],
	},
	{
		id: "latin", weight: 8,
		female: ["Valentina", "Camila", "Lucía", "Isabella", "Ximena", "Catalina", "Daniela", "Renata", "Marisol", "Paola", "Carolina", "Fernanda", "Alejandra", "Gabriela", "Mariana", "Josefina"],
		male: ["Santiago", "Mateo", "Sebastián", "Diego", "Emiliano", "Joaquín", "Rodrigo", "Andrés", "Esteban", "Matías", "Alejandro", "Ignacio", "Cristóbal", "Javier", "Bruno", "Leandro"],
		last: ["Hernández", "Vargas", "Castillo", "Mendoza", "Rojas", "Navarro", "Ortega", "Fuentes", "Salazar", "Bustamante", "Cabrera", "Espinoza", "Montenegro", "Quintero", "Valdés", "Zamora", "Ibarra", "Escobar"],
	},
	{
		id: "iberian", weight: 4,
		female: ["Inês", "Beatriz", "Leonor", "Carolina", "Marta", "Lola", "Carmen", "Elena", "Irene", "Pilar"],
		male: ["Tomás", "Rafael", "Duarte", "Miguel", "Gonçalo", "Álvaro", "Pablo", "Íñigo", "Hugo", "Jorge"],
		last: ["Duarte", "Carvalho", "Almeida", "Teixeira", "Moura", "Garrido", "Iglesias", "Romero", "Medina", "Beltrán", "Alves", "Figueiredo"],
	},
	{
		id: "brazil", weight: 3,
		female: ["Larissa", "Thaís", "Juliana", "Bianca", "Letícia", "Isadora", "Amanda", "Luana"],
		male: ["Thiago", "Caio", "Murilo", "Vinícius", "Gustavo", "Rodolfo", "Felipe", "Davi"],
		last: ["Oliveira", "Barbosa", "Cardoso", "Nascimento", "Macedo", "Rezende", "Pacheco", "Vasconcelos", "Siqueira", "Bittencourt"],
	},
	{
		id: "french", weight: 5,
		female: ["Camille", "Amélie", "Élodie", "Margaux", "Delphine", "Océane", "Manon", "Solène", "Odette", "Léa", "Colette", "Apolline"],
		male: ["Étienne", "Lucien", "Baptiste", "Rémi", "Mathieu", "Gaspard", "Florian", "Antoine", "Théo", "Arnaud", "Maxime", "Olivier"],
		last: ["Moreau", "Lefèvre", "Fontaine", "Marchand", "Delacroix", "Beaumont", "Rousseau", "Lambert", "Girard", "Durand", "Vasseur", "Laurent", "Dufresne", "Montaigne"],
	},
	{
		id: "italian", weight: 4,
		female: ["Giulia", "Chiara", "Francesca", "Alessia", "Livia", "Sabrina", "Elisa", "Bianca", "Ilaria", "Serena"],
		male: ["Luca", "Matteo", "Lorenzo", "Fabrizio", "Dario", "Emilio", "Gianluca", "Massimo", "Nico", "Salvatore"],
		last: ["Ricci", "Bellini", "Conti", "Moretti", "Ferrara", "Greco", "Caruso", "Barbieri", "Lombardi", "Santoro", "De Luca", "Rinaldi"],
	},
	{
		id: "german", weight: 4,
		female: ["Greta", "Lena", "Annika", "Marlene", "Katja", "Friederike", "Leonie", "Hanna", "Sabine", "Ingrid"],
		male: ["Lukas", "Felix", "Jonas", "Matthias", "Konrad", "Florian", "Leon", "Anselm", "Dieter", "Stefan"],
		last: ["Müller", "Brandt", "Hartmann", "Keller", "Vogel", "Lindner", "Bauer", "Schneider", "Falk", "Reinhardt", "Albrecht", "Engel", "Kessler"],
	},
	{
		id: "nordic", weight: 4,
		female: ["Astrid", "Freja", "Linnea", "Sigrid", "Ingrid", "Elsa", "Maja", "Thea", "Katrine", "Saga"],
		male: ["Magnus", "Erik", "Anders", "Leif", "Mikkel", "Oskar", "Henrik", "Soren", "Axel", "Gustav"],
		last: ["Lindqvist", "Johansen", "Eriksson", "Nygaard", "Bergström", "Halvorsen", "Dahl", "Sørensen", "Lundgren", "Haugen", "Virtanen", "Karlsen"],
	},
	{
		id: "eastern", weight: 5,
		female: ["Katarzyna", "Anya", "Milena", "Irina", "Zora", "Tereza", "Dasha", "Magdalena", "Vesna", "Ludmila", "Natalia", "Oksana"],
		male: ["Dmitri", "Tomasz", "Mikhail", "Luka", "Andrei", "Bogdan", "Viktor", "Radek", "Stefan", "Teodor", "Nikola", "Pavel"],
		last: ["Novak", "Kowalski", "Petrov", "Volkov", "Horvat", "Popescu", "Sokolov", "Nowicki", "Kovač", "Marek", "Dvořák", "Morozov", "Ilić", "Zielinski"],
	},
	{
		id: "greek", weight: 2,
		female: ["Eleni", "Katerina", "Sofia", "Despina", "Anastasia", "Ariadne", "Thalia"],
		male: ["Nikos", "Dimitris", "Yiannis", "Stavros", "Alexandros", "Kostas", "Theo"],
		last: ["Papadopoulos", "Karras", "Stathakis", "Georgiou", "Vlahos", "Mavros", "Demetriou", "Alexiou"],
	},
	{
		id: "west-african", weight: 5,
		female: ["Amara", "Adaeze", "Ngozi", "Folake", "Abena", "Ama", "Chiamaka", "Zainab", "Temitope", "Efua", "Yetunde", "Aminata"],
		male: ["Chidi", "Kwame", "Emeka", "Tunde", "Kofi", "Olumide", "Ikenna", "Seun", "Yaw", "Babatunde", "Obinna", "Sekou"],
		last: ["Okafor", "Mensah", "Adeyemi", "Okonkwo", "Boateng", "Owusu", "Balogun", "Nwosu", "Diallo", "Asante", "Adebayo", "Eze", "Traoré", "Onyango"],
	},
	{
		id: "east-african", weight: 3,
		female: ["Wanjiru", "Amani", "Selam", "Tigist", "Zawadi", "Nia", "Makena", "Rehema"],
		male: ["Kamau", "Haile", "Baraka", "Jabari", "Tendai", "Mulugeta", "Otieno", "Simba"],
		last: ["Kimani", "Tesfaye", "Mwangi", "Abebe", "Njoroge", "Okello", "Gebremariam", "Mutua", "Wekesa", "Kiplagat"],
	},
	{
		id: "southern-african", weight: 2,
		female: ["Thandiwe", "Lerato", "Naledi", "Nomsa", "Palesa", "Zanele"],
		male: ["Sipho", "Thabo", "Tendai", "Bongani", "Lwazi", "Kagiso"],
		last: ["Dlamini", "Nkosi", "Ndlovu", "Mokoena", "Khumalo", "Zulu", "Moyo", "Sithole"],
	},
	{
		id: "arab", weight: 5,
		female: ["Layla", "Nadia", "Yasmin", "Samira", "Rania", "Dalia", "Salma", "Hana", "Noor", "Leila", "Mariam", "Farah"],
		male: ["Omar", "Karim", "Tariq", "Idris", "Yusuf", "Samir", "Hadi", "Rashid", "Zaid", "Amir", "Nabil", "Faisal"],
		last: ["Haddad", "Khoury", "Nasser", "Mansour", "Darwish", "Saleh", "Hamdan", "Bishara", "Aziz", "Jaber", "Farouk", "Qasim", "Sabbagh"],
	},
	{
		id: "persian-turkish", weight: 3,
		female: ["Shirin", "Roya", "Elif", "Defne", "Parisa", "Zehra", "Azadeh", "Selin"],
		male: ["Arash", "Kaan", "Cyrus", "Emre", "Darius", "Baran", "Reza", "Cem"],
		last: ["Kaya", "Yilmaz", "Rahimi", "Hosseini", "Demir", "Karimi", "Aksoy", "Jafari", "Özdemir", "Farahani"],
	},
	{
		id: "south-asian", weight: 7,
		female: ["Priya", "Anika", "Meera", "Divya", "Kavya", "Ishita", "Anjali", "Nisha", "Tara", "Sanaa", "Leela", "Rhea"],
		male: ["Arjun", "Rohan", "Vikram", "Aditya", "Kabir", "Dev", "Rahul", "Sanjay", "Imran", "Nikhil", "Zubin", "Ayaan"],
		last: ["Sharma", "Iyer", "Banerjee", "Kapoor", "Menon", "Chopra", "Rao", "Malhotra", "Siddiqui", "Bhatt", "Desai", "Chaudhry", "Nair", "Mukherjee", "Qureshi"],
	},
	{
		id: "east-asian", weight: 5,
		female: ["Yuki", "Mei", "Hana", "Soo-jin", "Ayame", "Jia", "Min-ji", "Sakura", "Lin", "Ji-woo", "Haruka", "Xiaoling"],
		male: ["Kenji", "Hiro", "Jun", "Min-ho", "Takeshi", "Wei", "Daichi", "Seung", "Jian", "Ryo", "Hyun", "Zhen"],
		last: ["Tanaka", "Nakamura", "Kim", "Park", "Wang", "Chen", "Watanabe", "Lee", "Zhao", "Takahashi", "Choi", "Liu", "Yamamoto", "Han"],
	},
	{
		id: "southeast-asian", weight: 3,
		female: ["Linh", "Mai", "Dewi", "Ploy", "Nur", "Thuy", "Anong", "Maria Clara"],
		male: ["Minh", "Arif", "Somchai", "Bayu", "Duc", "Jose", "Rizal", "Kiet"],
		last: ["Nguyen", "Tran", "Santos", "Wijaya", "Suwannarat", "Reyes", "Pham", "Hidayat", "Dela Cruz", "Pangestu"],
	},
	{
		id: "pacific", weight: 2,
		female: ["Moana", "Leilani", "Tui", "Mele", "Kalani", "Hinemoa"],
		male: ["Tane", "Koa", "Manu", "Sione", "Kai", "Rawiri"],
		last: ["Tuilagi", "Kealoha", "Pomare", "Matagi", "Wihongi", "Havili", "Faleolo", "Ngata"],
	},
	{
		id: "indigenous-americas", weight: 2,
		female: ["Nayeli", "Aiyana", "Citlali", "Kaya", "Tala", "Yaretzi"],
		male: ["Tupac", "Aponi", "Nahuel", "Cuauhtémoc", "Kele", "Atoq"],
		last: ["Yazzie", "Quispe", "Tsosie", "Huanca", "Begay", "Mamani", "Ahtone", "Cruz"],
	},
	{
		id: "caribbean", weight: 3,
		female: ["Shanice", "Imani", "Tamika", "Jasmine", "Nia", "Carmen", "Odessa", "Maxine"],
		male: ["Jamal", "Marcus", "Dante", "Winston", "Andre", "Desmond", "Tyrone", "Rashad"],
		last: ["Baptiste", "Marley", "Campbell", "Henry", "Pierre", "Williams", "Beckford", "Joseph", "Laurent", "Washington", "Jefferson"],
	},
	{
		id: "jewish-israeli", weight: 2,
		female: ["Talia", "Noa", "Shira", "Maya", "Adi", "Yael"],
		male: ["Eitan", "Noam", "Avi", "Ilan", "Gideon", "Ronen"],
		last: ["Cohen", "Levi", "Katz", "Mizrahi", "Friedman", "Abramov", "Ben-David", "Shapiro", "Rosen"],
	},
];

const TOTAL = REGIONS.reduce((sum, r) => sum + r.weight, 0);

const pickRegion = (): Region => {
	let roll = Math.random() * TOTAL;
	for (const r of REGIONS) {
		roll -= r.weight;
		if (roll <= 0) return r;
	}
	return REGIONS[0];
};

/**
 * A random name from one region.
 * @param taken  names already in use; the name is not repeated and is added to the set.
 */
export const genName = (gender: Gender, taken?: Set<string>): string => {
	let name = "";
	for (let attempt = 0; attempt < 30; attempt++) {
		const region = pickRegion();
		name = `${choice(gender === "female" ? region.female : region.male)} ${choice(region.last)}`;
		if (!taken || !taken.has(name)) break;
	}
	taken?.add(name);
	return name;
};
