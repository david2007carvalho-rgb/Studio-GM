// ─────────────────────────────────────────────────────────────
// realTalent.ts — the real-world starting roster.
// Each line: "Name|birthYear|overall|specialty codes".
// Ratings are subjective game values, not facts. Edit freely.
// Codes: co comedy, dr dramatic, ro romantic, ch character, ac action,
//        au auteur, vi visualStorytelling, ex experimental, cm commercial, ve versatile
// ─────────────────────────────────────────────────────────────
import { FREE_AGENT, SPECIALTY_ATTRIBUTES } from "./constants";
import { estimatePot } from "./develop";
import { genContract, genSpecialties } from "./generate";
import { ovr } from "./ovr";
import { clamp } from "./random";
import { genTraits, seededRandom } from "./traits";
import { ATTRIBUTE_KEYS } from "./types";
import type { Gender, Person, ProductionRatings, ProductionRole, Specialty } from "./types";

export const CODE: Record<string, Specialty> = {
	co: "comedy", dr: "dramatic", ro: "romantic", ch: "character", ac: "action",
	au: "auteur", vi: "visualStorytelling", ex: "experimental", cm: "commercial", ve: "versatile",
};

// Women in the real roster (everyone else is a man). Used for the separate actor / actress awards.
const FEMALE = new Set([
	"Meryl Streep",
	"Helen Mirren",
	"Jodie Foster",
	"Michelle Pfeiffer",
	"Sigourney Weaver",
	"Susan Sarandon",
	"Sally Field",
	"Julia Roberts",
	"Nicole Kidman",
	"Sandra Bullock",
	"Halle Berry",
	"Viola Davis",
	"Angela Bassett",
	"Jamie Lee Curtis",
	"Michelle Yeoh",
	"Penélope Cruz",
	"Tilda Swinton",
	"Juliette Binoche",
	"Isabelle Huppert",
	"Julianne Moore",
	"Annette Bening",
	"Frances McDormand",
	"Glenn Close",
	"Laura Dern",
	"Naomi Watts",
	"Kristen Wiig",
	"Melissa McCarthy",
	"Lupita Nyong'o",
	"Zoe Saldaña",
	"Octavia Spencer",
	"Regina King",
	"Taraji P. Henson",
	"Cynthia Erivo",
	"Gabrielle Union",
	"Sanaa Lathan",
	"Scarlett Johansson",
	"Elizabeth Olsen",
	"Brie Larson",
	"Jennifer Lawrence",
	"Emma Stone",
	"Emma Watson",
	"Anne Hathaway",
	"Natalie Portman",
	"Charlize Theron",
	"Amy Adams",
	"Jessica Chastain",
	"Rachel McAdams",
	"Rachel Weisz",
	"Kirsten Dunst",
	"Margot Robbie",
	"Saoirse Ronan",
	"Florence Pugh",
	"Zendaya",
	"Anya Taylor-Joy",
	"Jenna Ortega",
	"Sydney Sweeney",
	"Millie Bobby Brown",
	"Awkwafina",
	"Sandra Oh",
	"Lily Gladstone",
	"Emily Blunt",
	"Carey Mulligan",
	"Keira Knightley",
	"Daisy Ridley",
	"Kathy Bates",
	"Jessica Lange",
	"Emma Thompson",
	"Olivia Colman",
	"Helena Bonham Carter",
	"Kristin Scott Thomas",
	"Marion Cotillard",
	"Léa Seydoux",
	"Eva Green",
	"Maggie Cheung",
	"Gong Li",
	"Zhang Ziyi",
	"Rinko Kikuchi",
	"Deepika Padukone",
	"Priyanka Chopra",
	"Noomi Rapace",
	"Alicia Vikander",
	"Rebecca Ferguson",
	"Mia Wasikowska",
	"Rose Byrne",
	"Elisabeth Moss",
	"Winona Ryder",
	"Margaret Qualley",
	"Ana de Armas",
	"Salma Hayek",
	"Rooney Mara",
	"Kate Hudson",
	"Zoë Kravitz",
	"Rosamund Pike",
	"Jodie Comer",
	"Ayo Edebiri",
	"Jean Smart",
	"Julia Garner",
	"Vera Farmiga",
	"Gwyneth Paltrow",
	"Patricia Arquette",
	"Holly Hunter",
	"Charlotte Rampling",
	"Lady Gaga",
	"Christina Ricci",
	"Kaitlyn Dever",
	"Dakota Johnson",
	"Lily James",
	"Rashida Jones",
	"Tessa Thompson",
	"Greta Gerwig",
	"Kathryn Bigelow",
	"Jane Campion",
	"Sofia Coppola",
	"Ava DuVernay",
	"Chloé Zhao",
	"Emerald Fennell",
	"Patty Jenkins",
	"Coralie Fargeat",
	"Julia Ducournau",
	"Céline Sciamma",
	"Claire Denis",
	"Agnieszka Holland",
	"Andrea Arnold",
	"Lynne Ramsay",
	"Mira Nair",
	"Zoya Akhtar",
	"Kelly Reichardt",
	"Lulu Wang",
	"Celine Song",
	"Olivia Wilde",
	"Gina Prince-Bythewood",
	"Nancy Meyers",
	"Jessie Buckley",
	"Selena Gomez",
	"Sarah Paulson",
	"Constance Wu",
	"Joanna Hogg",
	"Payal Kapadia",
	"Lily Collins",
	"Jung Ho-yeon",
	"Lily-Rose Depp",
	"Maggie Gyllenhaal",
	"Nia DaCosta",
	"Hunter Schafer",
	"Kerry Washington",
	"Yoon Yuh-jung",
	"Ann Hui",
	"Alice Rohrwacher",
	"Naomi Ackie",
	"Carrie Coon",
	"Reese Witherspoon",
	"Rachel Zegler",
	"Judi Dench",
	"Bella Ramsey",
	"Gurinder Chadha",
	"Zazie Beetz",
	"Cho Yeo-jeong",
	"Ariana DeBose",
	"Sadie Sink",
	"Lucrecia Martel",
	"Riley Keough",
	"Rose Glass",
	"Hailee Steinfeld",
	"Angelina Jolie",
	"Hong Chau",
	"Kitty Green",
	"Elle Fanning",
	"Lone Scherfig",
	"Domee Shi",
	"Rachel Sennott",
	"Kasi Lemmons",
	"Lashana Lynch",
	"Amanda Seyfried",
	"Emma Mackey",
	"Emilia Clarke",
	"Maren Ade",
	"Halina Reijn",
	"Janelle Monáe",
	"Rachel Brosnahan",
	"Cate Blanchett",
	"Odessa A'zion",
	"Kate Winslet",
	"Chloë Grace Moretz",
	"Niki Caro",
	"Gal Gadot",
	"Monica Barbaro",
	"Michelle Williams",
	"Jennifer Coolidge",
	"Felicity Jones",
	"Tatiana Maslany",
	"Dee Rees",
	"Rebecca Hall",
	"Da'Vine Joy Randolph",
	"Mackenzie Davis",
	"Kate Mara",
	"Sophie Turner",
	"Zoey Deutch",
	"Mikey Madison",
	"Susanne Bier",
	"Ruth Negga",
	"Jennifer Kent",
	"Mia Goth",
	"Mati Diop",
	"Deepa Mehta",
	"Justine Triet",
	"Maya Hawke",
	"Eliza Hittman",
	"Charlotte Wells",
	"Danielle Deadwyler",
	"Inde Navarrette",
	"Anna Kendrick",
	"Dakota Fanning",
	"Eiza González",
	"Stephanie Hsu",
	"Vanessa Kirby",
	"Karyn Kusama",
	"Jennifer Aniston",
	"Keke Palmer",
	"Toni Collette",
	"Naomie Harris",
	"Aubrey Plaza",
	"Adria Arjona",
	"Isabela Merced",
	"Sophie Thatcher",
	"Thandiwe Newton",
]);

const ACTORS = `
Meryl Streep|1949|94|ch ve
Robert De Niro|1943|90|ch dr
Al Pacino|1940|89|dr ch
Harrison Ford|1942|86|ac cm
Helen Mirren|1945|88|dr ch
Ian McKellen|1939|87|ch dr
Denzel Washington|1954|93|dr ac
Tom Hanks|1956|93|dr ve
Jodie Foster|1962|87|dr
Michelle Pfeiffer|1958|85|ro dr
Sigourney Weaver|1949|85|ac ch
Jeff Bridges|1949|86|ch ve
Susan Sarandon|1946|82|dr ch
Sally Field|1946|80|dr
Kevin Costner|1955|82|ac dr
Sean Penn|1960|88|dr ch
Tom Cruise|1962|91|ac cm
Brad Pitt|1963|91|cm ve
Keanu Reeves|1964|85|ac cm
Nicolas Cage|1964|84|ch ex
Johnny Depp|1963|84|ch ex
George Clooney|1961|87|cm ro
Julia Roberts|1967|88|ro cm
Nicole Kidman|1967|90|dr ve
Sandra Bullock|1964|85|co ro
Halle Berry|1966|80|ac dr
Viola Davis|1965|92|dr ch
Angela Bassett|1958|87|dr
Laurence Fishburne|1961|82|dr
Samuel L. Jackson|1948|88|cm ch
Bill Murray|1950|86|co ch
Jamie Lee Curtis|1958|84|co ch
Michelle Yeoh|1962|88|ac ve
Javier Bardem|1969|88|ch dr
Penélope Cruz|1974|86|dr ro
Antonio Banderas|1960|78|ac ro
Willem Dafoe|1955|88|ch ex
Gary Oldman|1958|91|ch ve
Ralph Fiennes|1962|89|dr ch
Colin Firth|1960|84|dr ro
Hugh Grant|1960|80|ro co
Tilda Swinton|1960|88|ex ch
Juliette Binoche|1964|87|dr ro
Isabelle Huppert|1953|88|dr ex
Tommy Lee Jones|1946|84|ch dr
Christopher Walken|1943|82|ch
Jeff Goldblum|1952|80|ch co
John Malkovich|1953|82|ch ex
Bill Nighy|1949|79|ch co
Stellan Skarsgård|1951|82|ch dr
Julianne Moore|1960|90|dr ch
Annette Bening|1958|85|dr
Frances McDormand|1957|91|ch dr
Glenn Close|1947|87|dr ch
Laura Dern|1967|85|dr ch
Naomi Watts|1968|80|dr
Ewan McGregor|1971|82|ve ro
Liam Neeson|1952|80|ac dr
Russell Crowe|1964|85|ac dr
Hugh Jackman|1968|86|ve ac
Mark Wahlberg|1971|76|ac cm
Matt Damon|1970|88|ve ac
Ben Affleck|1972|82|dr ac
Leonardo DiCaprio|1974|94|dr ve
Christian Bale|1974|93|ch ve
Edward Norton|1969|86|ch dr
Jim Carrey|1962|85|co ch
Will Smith|1968|86|cm co
Eddie Murphy|1961|83|co cm
Adam Sandler|1966|80|co dr
Ben Stiller|1965|74|co
Steve Carell|1962|83|co dr
Will Ferrell|1967|80|co
Jack Black|1969|78|co cm
Paul Rudd|1969|80|co cm
Kristen Wiig|1973|79|co ch
Melissa McCarthy|1970|77|co
Owen Wilson|1968|72|co
Seth Rogen|1982|74|co
Jonah Hill|1983|78|co dr
Kevin Hart|1979|70|co cm
Dwayne Johnson|1972|80|ac cm
Vin Diesel|1967|68|ac
Jason Statham|1967|72|ac
Jackie Chan|1954|78|ac co
Jet Li|1963|74|ac
Arnold Schwarzenegger|1947|74|ac cm
Sylvester Stallone|1946|76|ac dr
Woody Harrelson|1961|85|ch ve
Joaquin Phoenix|1974|94|ch dr
Mahershala Ali|1974|89|dr ch
Idris Elba|1972|85|ac dr
Chiwetel Ejiofor|1977|85|dr
David Oyelowo|1976|82|dr
Don Cheadle|1964|84|ch ve
Jeffrey Wright|1965|86|ch dr
Forest Whitaker|1961|85|dr ch
Jamie Foxx|1967|84|ve co
Anthony Mackie|1978|76|ac
Michael B. Jordan|1987|87|dr ac
John David Washington|1984|76|ac dr
Lupita Nyong'o|1983|85|dr ch
Zoe Saldaña|1978|82|ac cm
Octavia Spencer|1970|83|ch dr
Regina King|1971|85|dr
Taraji P. Henson|1970|79|dr
Cynthia Erivo|1987|82|dr
Gabrielle Union|1972|72|ro
Sanaa Lathan|1971|71|ro dr
Christoph Waltz|1956|89|ch
Mads Mikkelsen|1965|89|ch dr
Oscar Isaac|1979|88|ve dr
Pedro Pascal|1975|86|cm dr
Diego Luna|1979|78|dr ro
Gael García Bernal|1978|82|dr ve
Benicio del Toro|1967|85|ch
Andy Serkis|1964|83|ch ex
Benedict Cumberbatch|1976|88|ch dr
Tom Hardy|1977|87|ch ac
Michael Fassbender|1977|87|dr ch
Cillian Murphy|1976|91|dr ch
Colin Farrell|1976|85|ch co
Brendan Gleeson|1955|84|ch co
Domhnall Gleeson|1983|78|ch co
Paul Mescal|1996|84|dr ro
Barry Keoghan|1992|85|ch ex
Jesse Plemons|1988|83|ch
Adam Driver|1983|90|dr ch
Ryan Gosling|1980|90|ve ro
Ryan Reynolds|1976|82|co cm
Chris Evans|1981|80|ac cm
Chris Hemsworth|1983|78|ac cm
Chris Pratt|1979|75|ac co
Chris Pine|1980|78|ac ro
Robert Downey Jr.|1965|90|cm ve
Mark Ruffalo|1967|83|dr ch
Jeremy Renner|1971|75|ac
Scarlett Johansson|1984|88|ve ac
Elizabeth Olsen|1989|82|dr
Brie Larson|1989|79|dr
Jennifer Lawrence|1990|88|ve dr
Emma Stone|1988|90|co ve
Emma Watson|1990|74|ro
Anne Hathaway|1982|84|ro ve
Natalie Portman|1981|88|dr
Charlize Theron|1975|89|ac dr
Amy Adams|1974|88|dr ro
Jessica Chastain|1977|87|dr
Rachel McAdams|1978|82|ro dr
Rachel Weisz|1970|85|dr
Kirsten Dunst|1982|80|dr ro
Margot Robbie|1990|88|ve cm
Saoirse Ronan|1994|91|dr ro
Florence Pugh|1996|89|dr ve
Zendaya|1996|86|ro dr
Timothée Chalamet|1995|90|dr ro
Tom Holland|1996|82|ac cm
Anya Taylor-Joy|1996|85|dr ex
Jenna Ortega|2002|78|ex
Austin Butler|1991|82|ch ro
Jacob Elordi|1997|78|ro
Sydney Sweeney|1997|74|ro cm
Millie Bobby Brown|2004|68|dr
Anthony Ramos|1991|72|ro
Daniel Kaluuya|1989|90|dr ch
Lakeith Stanfield|1991|84|ch ex
Steven Yeun|1983|82|dr ch
Ke Huy Quan|1971|80|ac co
Awkwafina|1988|73|co
Sandra Oh|1971|82|dr co
Lily Gladstone|1986|82|dr
Emily Blunt|1983|88|ve ro
Carey Mulligan|1985|86|dr
Keira Knightley|1985|82|dr ro
Daisy Ridley|1992|70|ac
John Boyega|1992|76|ac dr
Dev Patel|1990|83|dr ac
Riz Ahmed|1982|84|dr
Rami Malek|1981|82|dr ch
Eddie Redmayne|1982|83|dr
Daniel Radcliffe|1989|75|ch ex
Robert Pattinson|1986|85|ch ex
Taron Egerton|1989|76|ac ve
Henry Cavill|1983|72|ac
Jake Gyllenhaal|1980|88|dr ch
Mark Rylance|1960|89|ch dr
Bradley Cooper|1975|87|dr ve
Jared Leto|1971|78|ch ex
Matthew McConaughey|1969|87|dr ch
Josh Brolin|1968|83|ac dr
Ethan Hawke|1970|86|dr ch
Jason Bateman|1969|76|co dr
Bill Hader|1978|80|co dr
Jason Sudeikis|1975|74|co
John C. Reilly|1965|82|co dr
Steve Buscemi|1957|82|ch co
Paul Giamatti|1967|86|ch dr
Bryan Cranston|1956|87|dr ch
Bob Odenkirk|1962|80|co dr
Jon Hamm|1971|78|dr co
Michael Keaton|1951|85|ch co
Richard Gere|1949|78|ro dr
Kurt Russell|1951|80|ac ch
Danny DeVito|1944|78|co ch
John Travolta|1954|75|cm ro
Viggo Mortensen|1958|85|dr ac
Sam Neill|1947|78|ch
Jeff Daniels|1955|82|ch co
Kathy Bates|1948|85|ch dr
Jessica Lange|1949|86|dr ch
Emma Thompson|1959|88|dr co
Olivia Colman|1974|89|ch co
Helena Bonham Carter|1966|82|ch ex
Kristin Scott Thomas|1960|82|dr
Marion Cotillard|1975|87|dr ro
Léa Seydoux|1985|82|dr ro
Eva Green|1980|78|ex ch
Vincent Cassel|1966|80|ch ac
Jean Dujardin|1972|76|co ro
Omar Sy|1978|76|co cm
Tony Leung|1962|90|ro dr
Maggie Cheung|1964|85|ro dr
Gong Li|1965|86|dr
Zhang Ziyi|1979|78|ac dr
Song Kang-ho|1967|88|ch co
Lee Byung-hun|1970|82|ac dr
Ken Watanabe|1959|82|dr ac
Hiroyuki Sanada|1960|80|ac dr
Rinko Kikuchi|1981|74|dr
Deepika Padukone|1986|78|ro cm
Shah Rukh Khan|1965|82|ro cm
Priyanka Chopra|1982|74|cm ro
Aamir Khan|1965|83|dr ch
Noomi Rapace|1979|76|ac dr
Alicia Vikander|1988|82|dr ro
Alexander Skarsgård|1976|79|ac ch
Rebecca Ferguson|1983|82|ac dr
Mia Wasikowska|1989|76|dr
Eric Bana|1968|75|ac dr
Geoffrey Rush|1951|86|ch
Guy Pearce|1967|82|ch
Rose Byrne|1979|78|co dr
Elisabeth Moss|1982|86|dr ch
Winona Ryder|1971|78|ch
Margaret Qualley|1994|79|ve
Ana de Armas|1988|79|ac ro
Salma Hayek|1966|77|ro co
Rooney Mara|1985|82|dr ex
Kate Hudson|1979|68|ro co
Zoë Kravitz|1988|75|dr
Rosamund Pike|1979|83|dr ch
Jodie Comer|1993|85|dr ve
Andrew Garfield|1983|85|dr ro
Glen Powell|1988|76|cm ro
Sebastian Stan|1982|83|ch ve
Jeremy Allen White|1991|80|dr
Ayo Edebiri|1995|74|co
Jean Smart|1951|84|co dr
Julia Garner|1994|80|dr ch
Ben Whishaw|1980|84|dr ch
Andrew Scott|1976|84|dr ch
Stanley Tucci|1960|85|ch co
Vera Farmiga|1973|80|dr
Gwyneth Paltrow|1972|72|ro
Patricia Arquette|1968|80|dr
Holly Hunter|1958|82|dr ch
Mark Hamill|1951|74|ch
Charlotte Rampling|1946|82|dr ex
Dennis Quaid|1954|72|ac
Lady Gaga|1986|74|dr
Casey Affleck|1975|84|dr ch
Christina Ricci|1980|72|ex ch
Sam Worthington|1976|66|ac
Diego Boneta|1990|52|ro
Kaitlyn Dever|1996|78|dr
Dakota Johnson|1989|73|ro
Lily James|1989|70|ro
Rashida Jones|1976|68|co ro
Danny McBride|1976|66|co
Tessa Thompson|1983|76|dr ac
Ncuti Gatwa|1992|70|co dr
Inde Navarrette|2001|64|dr
Jessie Buckley|1989|88|dr ch
Mikey Madison|1999|80|dr ch
Adria Arjona|1992|74|ac ro
Rachel Zegler|2001|68|ro
Sophie Thatcher|2000|72|dr ex
Odessa A'zion|2000|64|co
Monica Barbaro|1990|66|dr
Hailee Steinfeld|1996|74|dr ac
Elle Fanning|1998|82|dr ve
Dakota Fanning|1994|78|dr
Chloë Grace Moretz|1997|72|ac
Lily-Rose Depp|1999|68|ex
Mia Goth|1993|78|ex ch
Maya Hawke|1998|70|ch
Hunter Schafer|1998|66|dr
Sadie Sink|2002|70|dr
Isabela Merced|2001|64|ac
Selena Gomez|1992|64|co
Amanda Seyfried|1985|78|dr ro
Emma Mackey|1996|72|dr
Vanessa Kirby|1988|78|dr ac
Aubrey Plaza|1984|76|co ex
Jennifer Coolidge|1961|72|co
Cate Blanchett|1969|95|dr ve
Kate Winslet|1975|92|dr ve
Judi Dench|1934|88|dr ch
Angelina Jolie|1975|85|ac dr
Reese Witherspoon|1976|82|co dr
Jennifer Aniston|1969|76|co ro
Sarah Paulson|1974|82|ch
Toni Collette|1972|85|ch ve
Kerry Washington|1977|74|dr
Lashana Lynch|1987|70|ac
Naomie Harris|1976|76|dr ac
Thandiwe Newton|1972|78|dr
Danielle Deadwyler|1982|80|dr
Da'Vine Joy Randolph|1986|82|ch co
Ariana DeBose|1991|68|ro
Rachel Brosnahan|1990|72|co
Keke Palmer|1993|72|co
Eiza González|1990|66|ac
Zazie Beetz|1991|72|ch
Gal Gadot|1985|66|ac
Tatiana Maslany|1985|76|ve
Mackenzie Davis|1987|70|ch
Riley Keough|1989|74|dr
Lily Collins|1989|68|ro
Emilia Clarke|1986|70|dr
Sophie Turner|1996|68|ac dr
Anna Kendrick|1985|74|co ro
Rebecca Hall|1982|76|dr
Felicity Jones|1983|74|dr
Carrie Coon|1981|80|dr
Ruth Negga|1981|78|dr
Rachel Sennott|1995|68|co
Bella Ramsey|2003|70|dr
Zoey Deutch|1994|66|co ro
Constance Wu|1982|68|co dr
Michelle Williams|1980|88|dr
Naomi Ackie|1992|72|dr
Hong Chau|1979|78|ch
Stephanie Hsu|1990|72|co ex
Janelle Monáe|1985|70|ex
Cho Yeo-jeong|1981|74|ch dr
Yoon Yuh-jung|1947|80|ch
Jung Ho-yeon|1994|62|dr
Kate Mara|1983|66|dr
Jack Quaid|1991|72|co ac
Karl Urban|1972|74|ac cm
Josh O'Connor|1990|84|dr
Mike Faist|1992|74|dr
Callum Turner|1990|72|dr
Nicholas Hoult|1989|80|ve
Harris Dickinson|1996|78|dr
Joe Alwyn|1991|66|dr
Rege-Jean Page|1988|68|ro
Jonathan Bailey|1988|76|dr ro
Jeremy Strong|1978|82|dr ch
Kieran Culkin|1982|86|co ch
Matthew Macfadyen|1974|78|ch
Brian Cox|1946|84|ch
Mark Strong|1963|74|ch
Richard Madden|1986|72|dr
Aaron Taylor-Johnson|1990|76|ac dr
Jason Momoa|1979|70|ac
Joel Edgerton|1974|74|dr
Jon Bernthal|1976|78|dr ac
Walton Goggins|1971|78|ch
Giancarlo Esposito|1958|74|ch
Michael Shannon|1974|82|ch
Ben Mendelsohn|1969|78|ch
Jude Law|1972|82|ve
Orlando Bloom|1977|66|ac ro
Tobey Maguire|1975|74|dr
Jeremy Irons|1948|84|ch dr
Anthony Hopkins|1937|92|dr ch
Michael Caine|1933|84|ch
Morgan Freeman|1937|88|dr
John Lithgow|1945|80|ch
Ed Harris|1950|82|dr ch
William H. Macy|1950|74|ch
J.K. Simmons|1955|78|ch
Mel Gibson|1956|72|ac dr
Kumail Nanjiani|1978|66|co
Randall Park|1974|64|co
Simu Liu|1989|64|ac
Ben Kingsley|1943|84|dr ch
Dominic Sessa|2002|66|dr
Miles Teller|1987|74|dr
Jonathan Majors|1989|72|dr
Michael Peña|1976|70|co ch
Paul Dano|1984|82|ch dr
Lewis Pullman|1993|68|ac dr
Josh Hartnett|1978|72|dr
Jack Lowden|1990|70|dr
Nick Offerman|1970|70|co ch
Sacha Baron Cohen|1971|76|co ve
Luke Evans|1979|66|ac
Henry Golding|1987|64|ro
Daniel Craig|1968|86|ac dr
Michael Stuhlbarg|1968|78|ch
Sterling K. Brown|1976|76|dr
Bill Skarsgård|1990|76|ch
Brendan Fraser|1968|78|dr
Colman Domingo|1969|84|dr ch
Delroy Lindo|1952|80|dr
Wagner Moura|1976|76|dr
Jharrel Jerome|1997|70|dr
Cooper Hoffman|2003|66|dr
Gabriel LaBelle|2002|66|dr
Dave Bautista|1969|70|ac
Jason Clarke|1969|72|dr
Joe Keery|1992|66|co
Sam Rockwell|1968|82|ch co
Michael Cera|1988|70|co
Andy Samberg|1978|64|co
Kit Harington|1986|64|ac
Tom Hiddleston|1981|78|ve
Jim Broadbent|1949|78|ch
Tim Roth|1961|76|ch
Dylan O'Brien|1991|66|ac
Zac Efron|1987|72|ro co
Channing Tatum|1980|72|co ac
Jamie Dornan|1982|68|ro dr
Joseph Gordon-Levitt|1981|76|ve
Shia LaBeouf|1986|76|dr ch
Jason Segel|1980|68|co
Zach Galifianakis|1969|68|co
Jeremy Pope|1992|66|dr
Kodi Smit-McPhee|1996|72|dr
Ben Foster|1980|74|ch
Matthias Schoenaerts|1977|76|dr
Nikolaj Coster-Waldau|1970|68|ac
Franz Rogowski|1986|74|ex ch
Ma Dong-seok|1971|66|ac
Ranveer Singh|1985|74|ac ve
Hrithik Roshan|1974|74|ac ro
Prabhas|1979|68|ac cm
Ram Charan|1985|66|ac cm
Timothy Olyphant|1968|72|ac ch
Patrick Wilson|1973|72|ve
Aziz Ansari|1983|62|co
Rob Lowe|1964|62|co
Bobby Cannavale|1970|68|ch
Jeffrey Dean Morgan|1966|66|ac
Thomas Brodie-Sangster|1990|62|dr
`;

const DIRECTORS = `
Steven Spielberg|1946|96|cm vi
Martin Scorsese|1942|96|au dr
Christopher Nolan|1970|95|vi au
Quentin Tarantino|1963|92|au ex
Denis Villeneuve|1967|94|vi au
Greta Gerwig|1983|88|au co
Paul Thomas Anderson|1970|93|au ex
Wes Anderson|1969|88|au ex
David Fincher|1962|93|au vi
James Cameron|1954|94|vi cm
Peter Jackson|1961|90|vi cm
Guillermo del Toro|1964|91|vi ex
Alfonso Cuarón|1961|92|vi au
Alejandro G. Iñárritu|1963|90|au vi
Bong Joon-ho|1969|94|au ve
Park Chan-wook|1963|90|au vi
Ang Lee|1954|90|ve dr
Kathryn Bigelow|1951|89|au vi
Jane Campion|1954|88|au dr
Sofia Coppola|1971|82|au
Steve McQueen|1969|88|au dr
Barry Jenkins|1979|89|au dr
Ryan Coogler|1986|88|cm dr
Jordan Peele|1979|90|au ex
Ava DuVernay|1972|82|dr
Chloé Zhao|1982|84|au vi
Emerald Fennell|1985|80|au ex
Taika Waititi|1975|82|co ex
Edgar Wright|1974|86|co vi
Matthew Vaughn|1971|78|cm vi
Guy Ritchie|1968|76|cm
Danny Boyle|1956|85|vi ex
Sam Mendes|1965|88|dr vi
Joe Wright|1972|78|dr vi
Tom Hooper|1972|76|dr
Kenneth Branagh|1960|78|dr ve
Ron Howard|1954|82|cm dr
Robert Zemeckis|1952|86|cm vi
Michael Mann|1943|88|au vi
Oliver Stone|1946|80|au dr
Spike Lee|1957|86|au dr
Pedro Almodóvar|1949|90|au dr
Yorgos Lanthimos|1973|90|ex au
Ari Aster|1986|86|ex au
Robert Eggers|1983|87|vi ex
Jeff Nichols|1978|80|au dr
Darren Aronofsky|1969|87|ex au
Todd Phillips|1970|76|co cm
Adam McKay|1968|80|co au
Judd Apatow|1967|76|co
Paul Feig|1962|72|co
Nancy Meyers|1949|74|co ro
Richard Linklater|1960|88|au ve
Alexander Payne|1961|86|au co
Noah Baumbach|1969|84|au dr
Jason Reitman|1977|76|co dr
Rian Johnson|1973|83|au ve
J.J. Abrams|1966|78|cm vi
Jon Favreau|1966|78|cm co
James Gunn|1966|82|cm co
Zack Snyder|1966|72|vi ac
Michael Bay|1965|66|ac cm
Roland Emmerich|1955|64|cm vi
Justin Lin|1971|68|ac cm
Patty Jenkins|1971|74|ac dr
Jon M. Chu|1979|74|cm ro
Destin Daniel Cretton|1978|72|dr
Chad Stahelski|1968|78|ac vi
David Leitch|1975|72|ac co
Joseph Kosinski|1974|76|vi ac
Doug Liman|1965|68|ac
Gore Verbinski|1964|72|vi cm
Sam Raimi|1959|80|vi ex
Brian De Palma|1940|82|au vi
David Cronenberg|1943|88|au ex
John Carpenter|1948|80|au ex
Mike Flanagan|1978|78|dr ex
James Wan|1977|80|vi cm
Scott Derrickson|1966|70|vi
Coralie Fargeat|1976|78|ex vi
Julia Ducournau|1983|82|ex au
Céline Sciamma|1978|84|au ro
Claire Denis|1946|84|au ex
Agnieszka Holland|1948|80|au dr
Hirokazu Kore-eda|1962|89|au dr
Ryusuke Hamaguchi|1978|86|au dr
Wong Kar-wai|1958|91|au vi
Zhang Yimou|1950|86|vi dr
Asghar Farhadi|1972|88|au dr
Paolo Sorrentino|1970|85|vi au
Luca Guadagnino|1971|86|ro vi
Joachim Trier|1974|84|au dr
Ruben Östlund|1974|84|au co
Andrea Arnold|1961|80|au dr
Lynne Ramsay|1969|85|au ex
Mira Nair|1957|78|dr
S. S. Rajamouli|1973|86|vi cm
Zoya Akhtar|1972|74|dr co
Gareth Edwards|1975|72|vi
Neill Blomkamp|1979|62|vi ex
Duncan Jones|1971|68|ex
Matt Reeves|1966|84|vi dr
Todd Haynes|1961|85|au dr
Kelly Reichardt|1964|80|au
Lulu Wang|1983|76|dr co
Celine Song|1988|78|ro au
Sean Baker|1971|85|au co
Brady Corbet|1988|78|au ex
Olivia Wilde|1984|60|co
Gina Prince-Bythewood|1969|78|ro dr
Lee Daniels|1959|66|dr
Tyler Perry|1969|58|cm
F. Gary Gray|1969|72|ac cm
Antoine Fuqua|1965|76|ac dr
Taylor Sheridan|1970|82|dr au
Paul Greengrass|1955|82|dr ac
Tomas Alfredson|1965|78|au vi
Francis Lawrence|1971|70|ac vi
Justine Triet|1978|82|au dr
Maren Ade|1976|80|au co
Alice Rohrwacher|1981|76|au
Payal Kapadia|1986|70|au
Mati Diop|1982|72|au ex
Halina Reijn|1975|68|ex
Jennifer Kent|1969|68|ex vi
Karyn Kusama|1968|66|ex
Maggie Gyllenhaal|1977|72|au dr
Kitty Green|1984|70|au
Eliza Hittman|1979|70|au dr
Nia DaCosta|1989|74|vi dr
Rose Glass|1990|72|ex vi
Charlotte Wells|1987|74|au dr
Joanna Hogg|1960|74|au
Lone Scherfig|1959|66|ro dr
Susanne Bier|1960|72|dr
Niki Caro|1966|60|dr cm
Gurinder Chadha|1960|62|co
Deepa Mehta|1950|66|dr
Lucrecia Martel|1966|76|au
Kasi Lemmons|1961|68|dr
Dee Rees|1977|70|dr
Ann Hui|1947|74|dr
Domee Shi|1989|72|vi co
Ridley Scott|1937|91|vi cm
Francis Ford Coppola|1939|92|au vi
Joel Coen|1954|91|au co
Terrence Malick|1943|88|au vi
Michael Haneke|1942|88|au
Pawel Pawlikowski|1957|80|au
Damien Chazelle|1985|90|au vi
Tony Gilroy|1956|76|dr
George Miller|1945|92|vi ac
Baz Luhrmann|1962|82|vi
Tim Burton|1958|82|vi ex
Dan Trachtenberg|1981|74|ac vi
Jaume Collet-Serra|1974|66|ac
Ben Wheatley|1972|66|ex
Jim Jarmusch|1953|84|au
Mike Leigh|1943|84|au dr
Ken Loach|1936|80|au dr
Andrew Haigh|1973|80|au dr
Mike Mills|1966|78|au
Charlie Kaufman|1958|82|ex au
Spike Jonze|1969|80|ex au
Michel Gondry|1963|72|ex
Jean-Pierre Jeunet|1953|72|vi
Luc Besson|1959|70|ac cm
Gaspar Noé|1963|72|ex
Leos Carax|1960|76|ex
Jacques Audiard|1952|84|au dr
Kogonada|1974|72|au
Jeremy Saulnier|1976|70|ac
David Lowery|1980|72|au vi
Shawn Levy|1968|68|co cm
Jon Watts|1981|66|cm
Zach Cregger|1981|76|ex
Osgood Perkins|1974|74|ex vi
Ti West|1980|72|ex
Steven Soderbergh|1963|88|ve
Alex Garland|1970|80|vi ex
Yann Demange|1977|68|dr
Jonathan Glazer|1965|84|au ex
Steven Knight|1959|70|dr
Armando Iannucci|1963|74|co
Robert Rodriguez|1968|70|ac cm
Bill Condon|1955|72|dr
Rob Marshall|1960|68|cm
Chris Columbus|1958|68|cm co
Brad Bird|1957|84|vi
Pete Docter|1968|88|vi
Andrew Stanton|1965|80|vi
Lee Unkrich|1967|78|vi
Dean DeBlois|1970|80|vi
Chris Sanders|1962|76|vi
Phil Lord|1975|72|co vi
Christopher Miller|1975|72|co vi
Genndy Tartakovsky|1970|70|vi
Henry Selick|1952|78|vi ex
Travis Knight|1973|70|vi
Hong Sang-soo|1960|78|au
Lee Chang-dong|1954|86|au dr
Na Hong-jin|1974|78|ex vi
Hayao Miyazaki|1941|96|vi au
Makoto Shinkai|1973|82|vi ro
Mamoru Hosoda|1967|78|vi
Takashi Miike|1960|74|ex
Apichatpong Weerasethakul|1970|80|ex au
Jia Zhangke|1970|78|au
Chen Kaige|1952|74|dr
Walter Salles|1956|80|dr
Fernando Meirelles|1955|76|vi dr
Carlos Reygadas|1971|70|ex
Pablo Larraín|1976|84|au dr
Sebastián Lelio|1974|76|dr
Alejandro Amenábar|1972|74|dr vi
J.A. Bayona|1975|74|vi dr
Paul Verhoeven|1938|82|ex cm
Lars von Trier|1956|82|ex au
Thomas Vinterberg|1969|80|au dr
Andrei Zvyagintsev|1964|72|au
Peter Weir|1944|86|au dr
Garth Davis|1974|68|dr
Edward Zwick|1952|72|dr
Joe Russo|1971|70|cm ac
Anthony Russo|1970|70|cm ac
Michael Showalter|1970|60|co
David Gordon Green|1975|62|dr
Louis Leterrier|1973|62|ac
Peyton Reed|1964|62|cm co
Jaco Van Dormael|1957|66|au
Sam Esmail|1977|76|au vi
Jeff Tremaine|1966|50|co
Cooper Raiff|1997|60|co ro
Eric Appel|1976|52|co
`;

// Small deterministic random generator so a person always gets the same ratings.
const seeded = (text: string) => {
	let h = 2166136261;
	for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return () => {
		h = (h + 0x6d2b79f5) | 0;
		let t = Math.imul(h ^ (h >>> 15), 1 | h);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** Turn "overall + specialties" into the 9 attributes: specialty attributes high, the rest lower. */
export const buildAttrs = (name: string, level: number, role: ProductionRole, specs: Specialty[]): ProductionRatings => {
	const rand = seeded(name);
	const boosted = new Set(specs.flatMap((s) => SPECIALTY_ATTRIBUTES[s]));
	const attrs = {} as ProductionRatings;
	for (const key of ATTRIBUTE_KEYS) {
		attrs[key] = clamp(level + (boosted.has(key) ? 8 : -5) + (rand() - 0.5) * 8);
	}
	// Nudge everything so the overall matches the target (clamping can undo part of it, so repeat).
	for (let i = 0; i < 4; i++) {
		const diff = level - ovr(attrs, role);
		if (diff === 0) break;
		for (const key of ATTRIBUTE_KEYS) attrs[key] = clamp(attrs[key] + diff);
	}
	for (const key of ATTRIBUTE_KEYS) attrs[key] = Math.round(attrs[key]);
	return attrs;
};

const parse = (block: string, role: ProductionRole) =>
	block
		.trim()
		.split("\n")
		.map((line) => line.split("|"))
		.filter((parts) => parts.length === 4)
		.map(([name, born, level, codes]) => ({
			name,
			born: Number(born),
			level: Number(level),
			role,
			gender: (FEMALE.has(name) ? "female" : "male") as Gender,
			specs: codes.split(" ").map((c) => CODE[c]).filter(Boolean),
		}));

export const REAL_ROSTER = [...parse(ACTORS, "actor"), ...parse(DIRECTORS, "director")];

/** All real people as Person objects, for a new game starting in `season`. */
export const genRealPeople = (startPid: number, season: number): Person[] =>
	REAL_ROSTER.map((r, i) => {
		const age = season - r.born;
		const attrs = buildAttrs(r.name, r.level, r.role, r.specs);
		const current = ovr(attrs, r.role);
		return {
			pid: startPid + i,
			name: r.name,
			role: r.role,
			gender: r.gender,
			age,
			attrs,
			specialties: genSpecialties(attrs),
			pot: estimatePot(current, age, r.role),
			contract: genContract(current, season),
			tid: FREE_AGENT,
			real: true,
			// the same name always gets the same personality (see traits.ts)
			...genTraits(r.role, age, current, seededRandom(r.name)),
		};
	});
