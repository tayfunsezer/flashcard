(function (LG) {
  // Built-in sample data (Polish in column 1, English translation in column 2): 4 categories, 3 dates, half sentences.
  const D1 = '13-10-2026';
  const D2 = '20-10-2026';
  const D3 = '24-10-2026';

  LG.sampleRows = [
    ['chleb', 'bread', D1, 'Food|Home'],
    ['jabłko', 'apple', D1, 'Food'],
    ['śniadanie', 'breakfast', D1, 'Food|Home'],
    ['cukier', 'sugar', D2, 'Food'],
    ['herbata', 'tea', D2, 'Food|Home'],
    ['Codziennie rano piję herbatę.', 'I drink tea every morning.', D1, 'Food'],
    ['Chleb w tej piekarni jest bardzo świeży.', 'The bread at this bakery is very fresh.', D1, 'Food|Home'],
    ['Czy możemy prosić o rachunek?', 'Can we have the bill, please?', D2, 'Food'],
    ['Moja mama gotuje rybę w piątki.', 'My mother cooks fish on Fridays.', D2, 'Food|Home'],
    ['Nie jem deseru po obiedzie.', 'I do not eat dessert after dinner.', D3, 'Food'],

    ['bilet', 'ticket', D1, 'Travel'],
    ['most', 'bridge', D1, 'Travel'],
    ['walizka', 'suitcase', D2, 'Travel'],
    ['ulica', 'street', D2, 'Travel'],
    ['mapa', 'map', D3, 'Travel'],
    ['Pociąg odjeżdża o dziewiątej.', 'The train leaves at nine o\'clock.', D1, 'Travel'],
    ['Gdzie jest najbliższy przystanek autobusowy?', 'Where is the nearest bus stop?', D1, 'Travel'],
    ['Przeszliśmy przez most pieszo.', 'We crossed the bridge on foot.', D2, 'Travel'],
    ['Niestety zgubiłem walizkę na lotnisku.', 'Unfortunately I lost my suitcase at the airport.', D3, 'Travel'],
    ['Ile kosztuje bilet do Gdańska?', 'How much is a ticket to Gdansk?', D3, 'Travel'],

    ['okno', 'window', D1, 'Home'],
    ['drzwi', 'door', D1, 'Home'],
    ['kuchnia', 'kitchen', D2, 'Home|Food'],
    ['ogród', 'garden', D2, 'Home'],
    ['książka', 'book', D3, 'Home'],
    ['Czy możesz zamknąć okno?', 'Could you close the window, please?', D1, 'Home'],
    ['Klucze leżą na stole w kuchni.', 'The keys are on the kitchen table.', D2, 'Home'],
    ['W naszym ogrodzie jest dużo słońca.', 'Our garden gets a lot of sun.', D2, 'Home'],
    ['Po obiedzie zmywam naczynia.', 'I wash the dishes after dinner.', D3, 'Home'],
    ['Mała dziewczynka śpi w swoim pokoju.', 'The little girl is sleeping in her room.', D3, 'Home'],

    ['spotkanie', 'meeting', D1, 'Work'],
    ['raport', 'report', D1, 'Work'],
    ['pensja', 'salary', D2, 'Work'],
    ['pieniądze', 'money', D3, 'Work'],
    ['kolega z pracy', 'colleague', D3, 'Work'],
    ['Spotkanie zaczyna się za dziesięć minut.', 'The meeting starts in ten minutes.', D1, 'Work'],
    ['Muszę dziś skończyć raport.', 'I have to finish the report today.', D2, 'Work'],
    ['Mój kolega pracuje w poniedziałki z domu.', 'My colleague works from home on Mondays.', D2, 'Work'],
    ['Jest późno, idę do domu.', 'It is late, I am going home.', D3, 'Work'],
    ['Nasze biuro jest na czwartym piętrze.', 'Our office is on the fourth floor.', D3, 'Work'],
  ];
})(globalThis.LG = globalThis.LG || {});
