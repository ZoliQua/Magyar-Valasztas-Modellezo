-- Pártok seed data

INSERT OR IGNORE INTO parties (id, short_name, full_name, color, text_color, sort_order) VALUES
  ('fidesz_kdnp', 'Fidesz', 'Fidesz-KDNP', '#FD8204', '#FFFFFF', 1),
  ('tisza', 'Tisza', 'Tisza Párt', '#00A3E0', '#FFFFFF', 2),
  ('mi_hazank', 'Mi Hazánk', 'Mi Hazánk Mozgalom', '#4A7C3F', '#FFFFFF', 3),
  ('dk', 'DK', 'Demokratikus Koalíció', '#1B4D8E', '#FFFFFF', 4),
  ('mkkp', 'MKKP', 'Magyar Kétfarkú Kutya Párt', '#8B6914', '#FFFFFF', 5),
  ('mszp', 'MSZP', 'Magyar Szocialista Párt', '#CE2029', '#FFFFFF', 6),
  ('jobbik', 'Jobbik', 'Jobbik Magyarországért Mozgalom', '#000000', '#FFFFFF', 7),
  ('lmp', 'LMP', 'Lehet Más a Politika', '#83B431', '#FFFFFF', 8),
  ('egyseges_ellenzek', 'Egység', 'Egységben Magyarországért', '#4169E1', '#FFFFFF', 9),
  ('other', 'Egyéb', 'Egyéb pártok és függetlenek', '#999999', '#FFFFFF', 99);

-- Választási évek
INSERT OR IGNORE INTO elections (year, system, total_seats, oevk_seats, list_seats, turnout_pct, notes) VALUES
  (2006, 'old', 386, 176, 210, 67.83, 'Régi rendszer, kétfordulós, csak listás trendekhez'),
  (2010, 'old', 386, 176, 210, 64.36, 'Régi rendszer, kétfordulós, csak listás trendekhez'),
  (2014, 'new', 199, 106, 93, 61.73, 'Új rendszer, első alkalmazás'),
  (2018, 'new', 199, 106, 93, 69.73, 'Új rendszer'),
  (2022, 'new', 199, 106, 93, 69.54, 'Új rendszer, egységes ellenzéki jelöltek');
