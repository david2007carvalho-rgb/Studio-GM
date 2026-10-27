// ─────────────────────────────────────────────────────────────
// allTimeTalent.ts — the roster for the "All-Time" edition.
// The greatest actors and directors of all time, every one of them 18 years old
// and nowhere near their prime yet. Each line: "Name|M or F|prime overall|specialty codes".
// The prime is where they are destined to peak; they start well below it
// and grow into it (see develop.ts). Ratings are subjective game values.
// Codes: co comedy, dr dramatic, ro romantic, ch character, ac action,
//        au auteur, vi visualStorytelling, ex experimental, cm commercial, ve versatile
// ─────────────────────────────────────────────────────────────
import { FREE_AGENT } from "./constants";
import { growthLeft } from "./develop";
import { genContract } from "./generate";
import { ovr } from "./ovr";
import { buildAttrs, CODE } from "./realTalent";
import { genTraits, seededRandom } from "./traits";
import type { Gender, Person, ProductionRole } from "./types";

export const ALL_TIME_AGE = 18;

const ACTORS = `
Marlon Brando|M|98|ch dr
Meryl Streep|F|97|ch ve
Daniel Day-Lewis|M|98|ch dr
Robert De Niro|M|96|ch dr
Al Pacino|M|95|dr ch
Jack Nicholson|M|95|ch dr
Katharine Hepburn|F|95|dr ve
Ingrid Bergman|F|93|dr ro
Audrey Hepburn|F|92|ro co
Marilyn Monroe|F|90|co ro
Bette Davis|F|94|dr ch
Cary Grant|M|93|co ro
James Stewart|M|93|dr ve
Humphrey Bogart|M|92|dr ro
Charlie Chaplin|M|97|co ex
Buster Keaton|M|91|co vi
Laurence Olivier|M|94|dr ch
Paul Newman|M|92|dr ch
Sidney Poitier|M|90|dr
Henry Fonda|M|90|dr
Spencer Tracy|M|91|dr ve
Clark Gable|M|88|ro cm
John Wayne|M|88|ac cm
Gary Cooper|M|87|dr cm
Gregory Peck|M|88|dr
Montgomery Clift|M|87|dr ro
James Dean|M|88|ch dr
Burt Lancaster|M|88|ac dr
Kirk Douglas|M|87|dr ac
Peter O'Toole|M|90|ch dr
Richard Burton|M|90|dr ch
Alec Guinness|M|91|ch ve
Sean Connery|M|89|ac cm
Michael Caine|M|90|ve ch
Anthony Hopkins|M|95|dr ch
Gene Hackman|M|93|dr ve
Dustin Hoffman|M|93|ch dr
Jack Lemmon|M|91|co dr
Robert Redford|M|89|ro cm
Steve McQueen|M|88|ac cm
Robin Williams|M|93|co ve
Philip Seymour Hoffman|M|93|ch dr
Heath Ledger|M|92|ch ve
Denzel Washington|M|95|dr ac
Tom Hanks|M|95|dr ve
Morgan Freeman|M|91|dr
Samuel L. Jackson|M|88|ch ac
Leonardo DiCaprio|M|94|dr ch
Brad Pitt|M|91|cm ve
Tom Cruise|M|90|ac cm
Harrison Ford|M|89|ac cm
Johnny Depp|M|88|ch ex
Joaquin Phoenix|M|94|ch dr
Christian Bale|M|93|ch ve
Gary Oldman|M|94|ch ve
Javier Bardem|M|90|ch dr
Mahershala Ali|M|90|dr ch
Eddie Murphy|M|88|co cm
Jim Carrey|M|86|co ve
Bill Murray|M|88|co dr
Peter Sellers|M|90|co ch
Gene Wilder|M|86|co
Will Smith|M|86|cm ac
Arnold Schwarzenegger|M|82|ac cm
Sylvester Stallone|M|83|ac dr
Bruce Lee|M|90|ac
Jackie Chan|M|88|ac co
Toshiro Mifune|M|93|ac dr
Max von Sydow|M|90|dr ch
Marcello Mastroianni|M|90|ro co
Alain Delon|M|87|ro dr
Jean Gabin|M|86|dr
Anthony Quinn|M|85|ch dr
Ben Kingsley|M|91|ch dr
Ian McKellen|M|91|ch dr
Mark Rylance|M|90|ch dr
Tom Hardy|M|88|ch ac
Ryan Gosling|M|88|ro dr
Timothée Chalamet|M|86|ro dr
Cillian Murphy|M|89|dr ch
Cate Blanchett|F|96|ve ch
Viola Davis|F|94|dr ch
Frances McDormand|F|92|ch dr
Judi Dench|F|93|dr ch
Maggie Smith|F|92|co ch
Helen Mirren|F|92|dr ch
Emma Thompson|F|91|dr co
Kate Winslet|F|93|dr ro
Nicole Kidman|F|91|dr ve
Julia Roberts|F|88|ro cm
Sandra Bullock|F|85|co cm
Jodie Foster|F|91|dr
Sigourney Weaver|F|89|ac ch
Susan Sarandon|F|87|dr
Diane Keaton|F|90|co ro
Jane Fonda|F|90|dr
Faye Dunaway|F|89|dr ch
Sissy Spacek|F|89|dr ch
Jessica Lange|F|91|dr ch
Julie Andrews|F|88|ro co
Liza Minnelli|F|85|ro ex
Judy Garland|F|91|ro ve
Elizabeth Taylor|F|92|ro dr
Vivien Leigh|F|93|dr ro
Grace Kelly|F|87|ro
Greta Garbo|F|93|dr ro
Marlene Dietrich|F|90|ro ex
Lauren Bacall|F|86|ro dr
Rita Hayworth|F|85|ro
Ava Gardner|F|86|ro dr
Joan Crawford|F|88|dr
Barbara Stanwyck|F|90|dr ve
Shirley MacLaine|F|88|co dr
Anne Bancroft|F|90|dr
Vanessa Redgrave|F|91|dr ch
Glenda Jackson|F|89|dr ch
Julie Christie|F|88|ro dr
Gena Rowlands|F|91|dr ch
Liv Ullmann|F|90|dr au
Sophia Loren|F|90|ro dr
Anna Magnani|F|91|dr ch
Catherine Deneuve|F|89|ro dr
Isabelle Huppert|F|93|dr ex
Juliette Binoche|F|90|dr ro
Marion Cotillard|F|90|dr ro
Michelle Yeoh|F|89|ac dr
Gong Li|F|88|dr
Charlize Theron|F|90|dr ac
Natalie Portman|F|89|dr ro
Angelina Jolie|F|86|ac cm
Halle Berry|F|84|dr ac
Julianne Moore|F|91|dr ch
Tilda Swinton|F|91|ex ch
Olivia Colman|F|91|dr co
Emma Stone|F|88|co ro
Jennifer Lawrence|F|88|dr cm
Scarlett Johansson|F|87|ve ac
Margot Robbie|F|87|ve cm
Saoirse Ronan|F|90|dr ro
Florence Pugh|F|89|dr ve
Lupita Nyong'o|F|88|dr ch
Zendaya|F|85|ro ve
Walter Matthau|M|86|co
Rod Steiger|M|87|ch dr
Lee Marvin|M|85|ac ch
Charlton Heston|M|85|ac dr
Yul Brynner|M|82|dr ac
Errol Flynn|M|82|ac ro
Fred Astaire|M|87|ro ex
Gene Kelly|M|86|ro ex
Bing Crosby|M|80|co ro
Groucho Marx|M|85|co
Harold Lloyd|M|84|co vi
Stan Laurel|M|84|co
Oliver Hardy|M|82|co
Boris Karloff|M|84|ch
Bela Lugosi|M|80|ch
Lon Chaney|M|86|ch ex
Peter Lorre|M|85|ch
Claude Rains|M|86|ch dr
Robert Mitchum|M|87|ac dr
Lee J. Cobb|M|85|dr
Karl Malden|M|83|dr
Eli Wallach|M|84|ch
Walter Brennan|M|80|ch
Rock Hudson|M|80|ro
Tony Curtis|M|82|co ro
Dean Martin|M|80|co ro
Frank Sinatra|M|85|dr ro
Sammy Davis Jr.|M|82|co ex
Rex Harrison|M|85|co ro
Ralph Richardson|M|90|dr ch
John Gielgud|M|90|dr ch
Paul Scofield|M|90|dr
Albert Finney|M|88|ch dr
Oliver Reed|M|82|ch ac
Terence Stamp|M|82|ch
Malcolm McDowell|M|83|ch ex
Roger Moore|M|78|ac co
Peter Cushing|M|82|ch
Christopher Lee|M|86|ch ac
Donald Sutherland|M|87|ch ve
Christopher Walken|M|89|ch ex
Harvey Keitel|M|87|ch dr
Joe Pesci|M|88|ch co
Robert Duvall|M|93|dr ch
James Caan|M|85|dr ac
John Cazale|M|90|dr ch
Richard Dreyfuss|M|85|dr co
Jeff Bridges|M|90|ch ve
Kevin Spacey|M|88|ch dr
Kevin Costner|M|82|dr cm
Bill Paxton|M|80|ch ac
Dennis Hopper|M|86|ch ex
Willem Dafoe|M|90|ch ex
John Malkovich|M|88|ch ex
Ed Harris|M|87|dr ch
Tommy Lee Jones|M|88|ch dr
Jeremy Irons|M|88|dr ch
Ralph Fiennes|M|90|dr ch
Liam Neeson|M|84|ac dr
Sean Penn|M|91|dr ch
Tim Robbins|M|84|dr
Edward Norton|M|89|ch ve
Matt Damon|M|87|dr ac
Ben Affleck|M|80|dr
George Clooney|M|86|ro co
Robert Downey Jr.|M|90|co ch
Chris Evans|M|80|ac cm
Hugh Jackman|M|86|ac ve
Russell Crowe|M|88|dr ac
Mel Gibson|M|84|ac dr
Keanu Reeves|M|85|ac ro
Nicolas Cage|M|88|ch ex
Jim Broadbent|M|85|ch co
Colin Firth|M|87|dr ro
Hugh Grant|M|80|ro co
Idris Elba|M|86|dr ac
Chiwetel Ejiofor|M|87|dr
Forest Whitaker|M|89|ch dr
Jamie Foxx|M|87|ve co
Don Cheadle|M|86|ch dr
Mark Ruffalo|M|86|ch dr
Jake Gyllenhaal|M|88|ch dr
Michael Fassbender|M|88|ch dr
Oscar Isaac|M|87|ch ve
Adam Driver|M|88|dr ch
Paul Dano|M|85|ch ex
Daniel Kaluuya|M|88|dr ch
Michael B. Jordan|M|86|dr ac
Austin Butler|M|84|ro ch
Paul Mescal|M|86|dr ro
Barry Keoghan|M|85|ch ex
Robert Pattinson|M|86|ch ex
Andy Serkis|M|85|ch ve
Benedict Cumberbatch|M|88|ch dr
Eddie Redmayne|M|86|dr ch
Rami Malek|M|85|ch dr
Gael García Bernal|M|85|dr ro
Javier Cámara|M|75|co dr
Song Kang-ho|M|90|ch dr
Choi Min-sik|M|88|ch dr
Tony Leung|M|90|ro dr
Chow Yun-fat|M|86|ac cm
Takeshi Kitano|M|86|ch ex
Ken Watanabe|M|85|dr ac
Shah Rukh Khan|M|88|ro cm
Amitabh Bachchan|M|92|dr ac
Aamir Khan|M|88|dr ve
Irrfan Khan|M|88|ch dr
Nawazuddin Siddiqui|M|84|ch
Rajinikanth|M|82|ac cm
Jean-Paul Belmondo|M|86|ac co
Gérard Depardieu|M|89|ch ve
Jean Reno|M|78|ac
Vincent Cassel|M|84|ch ac
Mathieu Amalric|M|82|ch
Klaus Kinski|M|88|ch ex
Bruno Ganz|M|88|dr ch
Christoph Waltz|M|89|ch
Mads Mikkelsen|M|90|dr ch
Stellan Skarsgård|M|86|ch dr
Viggo Mortensen|M|87|dr ac
Sacha Baron Cohen|M|80|co ex
Steve Martin|M|85|co
Mel Brooks|M|80|co
Dan Aykroyd|M|78|co
John Candy|M|80|co
Chris Farley|M|75|co
Adam Sandler|M|80|co dr
Jack Black|M|78|co
Seth Rogen|M|74|co
Will Ferrell|M|82|co
Steve Carell|M|84|co dr
Ben Stiller|M|78|co
Owen Wilson|M|75|co
Dwayne Johnson|M|78|ac cm
Vin Diesel|M|72|ac
Jason Statham|M|74|ac
Denholm Elliott|M|76|ch
Bette Midler|F|82|co ex
Barbra Streisand|F|90|ro ve
Cher|F|84|ro ch
Goldie Hawn|F|85|co ro
Whoopi Goldberg|F|87|co dr
Sally Field|F|86|dr
Shirley Temple|F|78|ro
Mary Pickford|F|86|ro
Lillian Gish|F|88|dr
Gloria Swanson|F|85|dr ch
Mae West|F|80|co
Jean Harlow|F|82|co ro
Carole Lombard|F|88|co ro
Irene Dunne|F|84|co dr
Myrna Loy|F|84|co ro
Ginger Rogers|F|86|ro ex
Rosalind Russell|F|85|co dr
Joan Fontaine|F|85|dr ro
Olivia de Havilland|F|91|dr ro
Deborah Kerr|F|88|dr ro
Jennifer Jones|F|82|dr
Gene Tierney|F|83|ro dr
Jean Simmons|F|85|dr ro
Ida Lupino|F|85|dr
Natalie Wood|F|86|ro dr
Kim Novak|F|82|ro
Doris Day|F|85|co ro
Debbie Reynolds|F|82|co ro
Patricia Neal|F|85|dr
Eva Marie Saint|F|84|dr ro
Geraldine Page|F|89|ch dr
Ellen Burstyn|F|90|dr ch
Louise Fletcher|F|87|dr ch
Shelley Winters|F|85|ch dr
Mia Farrow|F|84|dr
Karen Black|F|80|ch
Jessica Tandy|F|88|dr ch
Joan Plowright|F|86|dr co
Eileen Atkins|F|85|dr
Joanne Woodward|F|89|dr
Jacqueline Bisset|F|80|ro
Geraldine Chaplin|F|82|dr ex
Jeanne Moreau|F|91|dr ro
Brigitte Bardot|F|82|ro
Anna Karina|F|84|ro ex
Monica Vitti|F|87|dr ex
Giulietta Masina|F|88|dr ch
Claudia Cardinale|F|83|ro
Romy Schneider|F|86|dr ro
Hanna Schygulla|F|84|dr ex
Setsuko Hara|F|89|dr
Hideko Takamine|F|86|dr
Isuzu Yamada|F|85|dr ch
Maggie Cheung|F|90|dr ro
Zhang Ziyi|F|85|dr ac
Shu Qi|F|80|dr ro
Deepika Padukone|F|82|ro ac
Aishwarya Rai|F|80|ro
Nargis|F|86|dr
Madhubala|F|84|ro
Smita Patil|F|85|dr
Penélope Cruz|F|90|dr ro
Carmen Maura|F|82|co dr
Victoria Abril|F|80|ro
Noomi Rapace|F|82|dr ac
Alicia Vikander|F|85|dr ro
Léa Seydoux|F|85|dr ro
Emmanuelle Riva|F|88|dr
Charlotte Gainsbourg|F|84|dr ex
Eva Green|F|83|ro ex
Rooney Mara|F|83|dr ex
Anne Hathaway|F|85|dr ro
Amy Adams|F|88|dr ve
Jessica Chastain|F|88|dr ac
Rachel Weisz|F|87|dr ro
Rachel McAdams|F|82|ro dr
Kirsten Dunst|F|82|dr
Emily Blunt|F|87|ve dr
Carey Mulligan|F|86|dr
Keira Knightley|F|84|dr ro
Anya Taylor-Joy|F|84|ex dr
Jodie Comer|F|86|dr ch
Jessie Buckley|F|88|dr ch
Elizabeth Olsen|F|84|dr
Brie Larson|F|84|dr
Lily Gladstone|F|85|dr
Emma Watson|F|78|dr
Millie Bobby Brown|F|78|dr
Jenna Ortega|F|82|ch
Sydney Sweeney|F|78|ro
Lady Gaga|F|82|ro ex
Octavia Spencer|F|85|dr ch
Regina King|F|87|dr
Angela Bassett|F|90|dr ch
Cicely Tyson|F|89|dr
Ruby Dee|F|87|dr
Dorothy Dandridge|F|86|ro dr
Hattie McDaniel|F|86|co ch
Pam Grier|F|82|ac
Lena Horne|F|82|ro
Diahann Carroll|F|80|ro
Rita Moreno|F|86|ro ex
Helen Hunt|F|82|dr co
Holly Hunter|F|88|dr ch
Annette Bening|F|88|dr ch
Glenn Close|F|92|dr ch
Kathy Bates|F|90|ch dr
Laura Dern|F|88|dr ch
Michelle Pfeiffer|F|88|ro dr
Meg Ryan|F|82|ro co
Winona Ryder|F|83|dr
Naomi Watts|F|86|dr
Rachel Brosnahan|F|78|co
Kristen Stewart|F|83|dr
Carrie Fisher|F|82|co ac
Jamie Lee Curtis|F|84|ac co
Melissa McCarthy|F|78|co
Tina Fey|F|78|co
Lucille Ball|F|88|co
Carol Burnett|F|86|co
Gilda Radner|F|82|co
Madeline Kahn|F|86|co
Eve Arden|F|76|co
`;

const DIRECTORS = `
Alfred Hitchcock|M|98|au vi
Stanley Kubrick|M|98|au vi
Orson Welles|M|96|au vi
Akira Kurosawa|M|97|vi dr
Francis Ford Coppola|M|96|au dr
Martin Scorsese|M|97|au dr
Steven Spielberg|M|97|cm vi
Billy Wilder|M|95|co dr
John Ford|M|94|vi dr
Federico Fellini|M|94|au ex
Ingmar Bergman|M|96|au dr
Frank Capra|M|90|cm dr
Howard Hawks|M|91|cm ve
David Lean|M|94|vi dr
Sergio Leone|M|92|vi ac
Roman Polanski|M|90|dr au
Jean-Luc Godard|M|90|ex au
François Truffaut|M|91|au dr
Yasujiro Ozu|M|94|au dr
Satyajit Ray|M|93|au dr
Andrei Tarkovsky|M|95|au ex
Luis Buñuel|M|93|ex au
Michelangelo Antonioni|M|91|au ex
Werner Herzog|M|90|ex au
Rainer Werner Fassbinder|M|88|au dr
Robert Altman|M|91|au ve
Sidney Lumet|M|91|dr
Woody Allen|M|90|co au
Clint Eastwood|M|91|dr ac
Ridley Scott|M|92|vi cm
James Cameron|M|95|vi cm
George Lucas|M|90|vi cm
Quentin Tarantino|M|94|au ex
Christopher Nolan|M|96|vi au
David Fincher|M|94|au vi
Kathryn Bigelow|F|91|ac dr
Jane Campion|F|91|au dr
Agnès Varda|F|90|au ex
Sofia Coppola|F|86|au ro
Greta Gerwig|F|89|au co
Chloé Zhao|F|86|au vi
Hayao Miyazaki|M|97|vi au
Joel Coen|M|93|au co
Brian De Palma|M|86|vi cm
John Carpenter|M|85|vi ac
Tim Burton|M|86|vi ex
Ang Lee|M|92|dr ve
Wong Kar-wai|M|92|au ro
Bong Joon-ho|M|94|au ve
Park Chan-wook|M|91|vi ex
Guillermo del Toro|M|92|vi ex
Alejandro G. Iñárritu|M|91|au dr
Alfonso Cuarón|M|93|vi au
Pedro Almodóvar|M|92|au dr
Lars von Trier|M|88|ex au
Michael Haneke|M|91|au dr
Terrence Malick|M|93|au vi
David Lynch|M|93|ex au
Wes Anderson|M|90|au vi
Paul Thomas Anderson|M|94|au ex
Denis Villeneuve|M|94|vi au
Peter Jackson|M|90|vi cm
Spike Lee|M|89|au dr
Jean Renoir|M|94|au dr
Fritz Lang|M|93|vi ex
F. W. Murnau|M|92|vi ex
Sergei Eisenstein|M|93|vi ex
D. W. Griffith|M|85|vi dr
Vittorio De Sica|M|91|dr au
Robert Bresson|M|92|au ex
Kenji Mizoguchi|M|93|au dr
Elia Kazan|M|91|dr
William Wyler|M|93|dr cm
George Stevens|M|88|dr cm
Preston Sturges|M|88|co
Ernst Lubitsch|M|92|co ro
Victor Fleming|M|86|cm vi
Michael Powell|M|91|vi ex
Carol Reed|M|88|dr vi
Mike Nichols|M|91|co dr
Hal Ashby|M|87|au co
Sam Peckinpah|M|87|ac au
Sydney Pollack|M|87|dr cm
Milos Forman|M|91|dr co
Bernardo Bertolucci|M|90|vi au
Pier Paolo Pasolini|M|89|ex au
Nora Ephron|F|82|co ro
Lina Wertmüller|F|85|co au
Claire Denis|F|86|au ex
Chantal Akerman|F|87|au ex
Lynne Ramsay|F|84|au vi
Jean Vigo|M|88|ex au
Carl Theodor Dreyer|M|93|au dr
Max Ophüls|M|90|vi ro
Jacques Tati|M|91|co au
Robert Wiene|M|78|ex
Josef von Sternberg|M|87|vi ro
Erich von Stroheim|M|86|dr ex
Leo McCarey|M|85|co dr
Douglas Sirk|M|88|dr ro
Otto Preminger|M|86|dr
Joseph L. Mankiewicz|M|90|dr co
Fred Zinnemann|M|89|dr
John Huston|M|91|dr ac
Nicholas Ray|M|86|dr au
Samuel Fuller|M|85|ac au
Anthony Mann|M|86|ac dr
Robert Wise|M|88|ve cm
Vincente Minnelli|M|86|ro vi
Stanley Donen|M|85|co ro
George Cukor|M|89|co dr
Mervyn LeRoy|M|82|dr cm
Michael Curtiz|M|90|cm dr
Raoul Walsh|M|84|ac
William Wellman|M|84|ac dr
John Sturges|M|82|ac
Don Siegel|M|84|ac
Blake Edwards|M|85|co
Richard Brooks|M|83|dr
Arthur Penn|M|87|au dr
John Frankenheimer|M|87|dr ac
Norman Jewison|M|85|dr co
George Roy Hill|M|86|co cm
William Friedkin|M|88|ac dr
Peter Bogdanovich|M|85|dr au
Terry Gilliam|M|86|ex vi
Alan Parker|M|82|dr
Ken Russell|M|83|ex
Nicolas Roeg|M|88|ex vi
Lindsay Anderson|M|84|au ex
Ken Loach|M|88|dr au
Mike Leigh|M|90|dr au
Danny Boyle|M|88|vi cm
Joe Wright|M|82|vi dr
Sam Mendes|M|88|dr vi
Stephen Frears|M|86|dr co
Richard Linklater|M|91|au co
Steven Soderbergh|M|91|ve
Michael Mann|M|91|ac vi
Oliver Stone|M|88|dr
Spike Jonze|M|85|ex au
Charlie Kaufman|M|86|ex au
Darren Aronofsky|M|88|ex dr
Barry Jenkins|M|90|au dr
Ryan Coogler|M|88|dr cm
Jordan Peele|M|88|ex au
Taika Waititi|M|82|co vi
Edgar Wright|M|86|co vi
George Miller|M|92|ac vi
Peter Weir|M|90|au dr
Baz Luhrmann|M|84|vi ro
Andrew Dominik|M|82|au vi
Robert Zemeckis|M|90|cm vi
Ron Howard|M|84|dr cm
Rob Reiner|M|85|co dr
John Hughes|M|83|co
Harold Ramis|M|80|co
Ivan Reitman|M|78|co
Richard Donner|M|82|cm ac
Joe Dante|M|80|co ex
John McTiernan|M|82|ac
Tony Scott|M|82|ac vi
Michael Bay|M|72|ac cm
Zack Snyder|M|76|vi ac
J. J. Abrams|M|78|cm vi
James Wan|M|78|ac ex
Ari Aster|M|84|ex au
Robert Eggers|M|86|ex au
Yorgos Lanthimos|M|90|ex au
Ruben Östlund|M|84|au co
Paolo Sorrentino|M|88|vi au
Luca Guadagnino|M|86|ro vi
Matteo Garrone|M|84|au vi
Nuri Bilge Ceylan|M|90|au dr
Asghar Farhadi|M|90|dr au
Abbas Kiarostami|M|93|au ex
Jafar Panahi|M|88|au dr
Majid Majidi|M|82|dr
Zhang Yimou|M|90|vi dr
Chen Kaige|M|84|dr vi
Edward Yang|M|90|au dr
Hou Hsiao-hsien|M|91|au
Tsai Ming-liang|M|86|ex au
Jia Zhangke|M|87|au
Bi Gan|M|84|ex vi
Hirokazu Kore-eda|M|91|dr au
Kiyoshi Kurosawa|M|84|ex
Nagisa Oshima|M|87|ex au
Shohei Imamura|M|88|au dr
Masaki Kobayashi|M|88|dr
Isao Takahata|M|90|vi dr
Satoshi Kon|M|88|vi ex
Katsuhiro Otomo|M|85|vi
Mamoru Oshii|M|84|vi ex
Lee Chang-dong|M|90|au dr
Kim Ki-duk|M|80|ex
Hong Sang-soo|M|85|au
Johnnie To|M|86|ac vi
John Woo|M|88|ac vi
Tsui Hark|M|82|ac vi
Mira Nair|F|85|dr
Deepa Mehta|F|80|dr
Guru Dutt|M|90|dr ro
Raj Kapoor|M|87|dr ro
Mehboob Khan|M|85|dr
Mani Ratnam|M|86|dr ro
Anurag Kashyap|M|82|ex
S. S. Rajamouli|M|85|ac vi
Walter Salles|M|86|dr
Fernando Meirelles|M|85|vi dr
Glauber Rocha|M|85|ex au
Lucrecia Martel|F|86|au ex
Lisandro Alonso|M|78|au
Carlos Saura|M|85|au ex
Victor Erice|M|88|au
Alejandro Jodorowsky|M|84|ex
Emir Kusturica|M|87|ex co
Béla Tarr|M|90|au ex
Krzysztof Kieślowski|M|95|au dr
Andrzej Wajda|M|91|dr au
Miklós Jancsó|M|85|au ex
István Szabó|M|82|dr
Jan Švankmajer|M|84|ex
Aki Kaurismäki|M|87|co au
Theo Angelopoulos|M|90|au vi
Manoel de Oliveira|M|88|au
Jacques Rivette|M|87|au ex
Éric Rohmer|M|89|au ro
Claude Chabrol|M|87|au dr
Louis Malle|M|89|dr au
Alain Resnais|M|90|au ex
Jacques Demy|M|86|ro ex
Jean-Pierre Melville|M|91|vi au
Henri-Georges Clouzot|M|90|vi dr
Marcel Carné|M|87|dr ro
Maurice Pialat|M|85|dr au
Leos Carax|M|86|ex vi
Olivier Assayas|M|84|au
Jacques Audiard|M|88|dr ac
Céline Sciamma|F|87|au ro
Julia Ducournau|F|84|ex
Andrea Arnold|F|85|au dr
Ava DuVernay|F|82|dr
Patty Jenkins|F|78|ac dr
Kelly Reichardt|F|84|au
Penny Marshall|F|78|co
Amy Heckerling|F|78|co
Nancy Meyers|F|78|co ro
Elaine May|F|85|co au
Dorothy Arzner|F|82|dr
Lois Weber|F|80|dr
Alice Guy-Blaché|F|82|ex vi
Larisa Shepitko|F|84|dr au
Kira Muratova|F|82|au ex
Márta Mészáros|F|82|dr au
Maya Deren|F|82|ex
Barbara Loden|F|78|au
Joan Micklin Silver|F|75|dr
Emerald Fennell|F|82|ex co
Celine Song|F|82|au ro
Kogonada|M|78|au vi
Charlotte Wells|F|80|au dr
Maren Ade|F|85|au co
Alice Rohrwacher|F|84|au ex
`;

const parse = (block: string, role: ProductionRole) =>
	block
		.trim()
		.split("\n")
		.map((line) => line.split("|"))
		.filter((parts) => parts.length === 4)
		.map(([name, sex, prime, codes]) => ({
			name,
			gender: (sex === "F" ? "female" : "male") as Gender,
			prime: Number(prime),
			role,
			specs: codes.split(" ").map((c) => CODE[c]).filter(Boolean),
		}));

export const ALL_TIME_ROSTER = [...parse(ACTORS, "actor"), ...parse(DIRECTORS, "director")];

// Small stable hash so each legend always starts at the same spot below their prime.
const hash = (text: string) => {
	let h = 2166136261;
	for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return ((h >>> 0) % 1000) / 1000;
};

/** The all-time greats as 18-year-olds: well below their prime overall, with that prime as their potential. */
export const genAllTimePeople = (startPid: number, season: number): Person[] => {
	const seen = new Set<string>();
	return ALL_TIME_ROSTER.map((r) => {
		if (seen.has(r.name)) return null; // each legend appears once, as an actor or a director
		seen.add(r.name);
		// Start 85-105% of the expected growth below the prime, so some are further along than others.
		const gap = growthLeft(ALL_TIME_AGE, r.role) * (0.85 + hash(r.name) * 0.2);
		const start = Math.max(32, Math.round(r.prime - gap));
		const attrs = buildAttrs(r.name, start, r.role, r.specs);
		const current = ovr(attrs, r.role);
		return { r, attrs, current };
	})
		.filter((x): x is NonNullable<typeof x> => x !== null)
		.map(({ r, attrs, current }, i): Person => ({
			pid: startPid + i,
			name: r.name,
			role: r.role,
			gender: r.gender,
			age: ALL_TIME_AGE,
			attrs,
			specialties: r.specs, // they already show the talent they will be known for
			pot: r.prime, // the peak they are destined for
			contract: genContract(current, season),
			tid: FREE_AGENT,
			real: true,
			// the same name always gets the same personality (see traits.ts), judged by the prime they are heading for
			...genTraits(r.role, ALL_TIME_AGE, r.prime, seededRandom(r.name)),
		}));
};
