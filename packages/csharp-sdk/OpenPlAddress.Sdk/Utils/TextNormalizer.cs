using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace OpenPlAddress.Sdk.Utils
{
    public static class TextNormalizer
    {
        private static readonly Dictionary<char, char> PolishDiacriticsMap = new Dictionary<char, char>
        {
            ['ą'] = 'a', ['Ą'] = 'A',
            ['ć'] = 'c', ['Ć'] = 'C',
            ['ę'] = 'e', ['Ę'] = 'E',
            ['ł'] = 'l', ['Ł'] = 'L',
            ['ń'] = 'n', ['Ń'] = 'N',
            ['ó'] = 'o', ['Ó'] = 'O',
            ['ś'] = 's', ['Ś'] = 'S',
            ['ź'] = 'z', ['Ź'] = 'Z',
            ['ż'] = 'z', ['Ż'] = 'Z'
        };

        private static readonly Dictionary<string, string> KnownCyrillicWords = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["люблін"] = "lublin",
            ["люблин"] = "lublin",
            ["варшава"] = "warszawa",
            ["лодзь"] = "lodz",
            ["краків"] = "krakow",
            ["краков"] = "krakow",
            ["вроцлав"] = "wroclaw",
            ["познань"] = "poznan",
            ["ґданськ"] = "gdansk",
            ["гданськ"] = "gdansk",
            ["гдянск"] = "gdansk",
            ["щецин"] = "szczecin",
            ["бидгощ"] = "bydgoszcz",
            ["бидгощь"] = "bydgoszcz",
            ["катовиці"] = "katowice",
            ["катовице"] = "katowice",
            ["білосток"] = "bialystok",
            ["белосток"] = "bialystok",
            ["ряшів"] = "rzeszow",
            ["жешув"] = "rzeszow",
            ["торунь"] = "torun",
            ["кільце"] = "kielce",
            ["кельце"] = "kielce",
            ["ольштин"] = "olsztyn",
            ["ополе"] = "opole",
            ["зелена гура"] = "zielona gora",
            ["венявська"] = "wieniawska",
            ["венявска"] = "wieniawska",
            ["вєнявска"] = "wieniawska",
            ["краківське"] = "krakowskie",
            ["краковске"] = "krakowskie",
            ["рацлавицькі"] = "raclawickie",
            ["липова"] = "lipowa",
            ["спокійна"] = "spokojna",
            ["маршалковська"] = "marszalkowska",
            ["свентокшиська"] = "swietokrzyska",
            ["єрусалимські"] = "jerozolimskie",
            ["новий світ"] = "nowy swiat",
            ["піотрковська"] = "piotrkowska",
            ["флоріанська"] = "florianska"
        };

        private static readonly (Regex Pattern, string Replacement)[] CyrillicPhonetics = new (Regex, string)[]
        {
            (new Regex("ня", RegexOptions.Compiled), "nia"),
            (new Regex("вя", RegexOptions.Compiled), "wia"),
            (new Regex("мя", RegexOptions.Compiled), "mia"),
            (new Regex("бя", RegexOptions.Compiled), "bia"),
            (new Regex("пя", RegexOptions.Compiled), "pia"),
            (new Regex("дзя", RegexOptions.Compiled), "dzia"),
            (new Regex("тя", RegexOptions.Compiled), "tia"),
            (new Regex("дя", RegexOptions.Compiled), "dia"),
            (new Regex("ся", RegexOptions.Compiled), "sia"),
            (new Regex("зя", RegexOptions.Compiled), "zia"),
            (new Regex("ці", RegexOptions.Compiled), "ci"),
            (new Regex("сі", RegexOptions.Compiled), "si"),
            (new Regex("ні", RegexOptions.Compiled), "ni"),
            (new Regex("ді", RegexOptions.Compiled), "di"),
            (new Regex("ті", RegexOptions.Compiled), "ti"),
            (new Regex("ві", RegexOptions.Compiled), "wi"),
            (new Regex("мі", RegexOptions.Compiled), "mi"),
            (new Regex("бі", RegexOptions.Compiled), "bi"),
            (new Regex("пі", RegexOptions.Compiled), "pi"),
            (new Regex("щ", RegexOptions.Compiled), "szcz"),
            (new Regex("ч", RegexOptions.Compiled), "cz"),
            (new Regex("ш", RegexOptions.Compiled), "sz"),
            (new Regex("ж", RegexOptions.Compiled), "z"),
            (new Regex("х", RegexOptions.Compiled), "ch"),
            (new Regex("ць", RegexOptions.Compiled), "c"),
            (new Regex("дз", RegexOptions.Compiled), "dz"),
            (new Regex("дж", RegexOptions.Compiled), "dz"),
            (new Regex("є", RegexOptions.Compiled), "ie"),
            (new Regex("ї", RegexOptions.Compiled), "i"),
            (new Regex("ю", RegexOptions.Compiled), "iu"),
            (new Regex("я", RegexOptions.Compiled), "ia"),
            (new Regex("ґ", RegexOptions.Compiled), "g"),
            (new Regex("а", RegexOptions.Compiled), "a"),
            (new Regex("б", RegexOptions.Compiled), "b"),
            (new Regex("в", RegexOptions.Compiled), "w"),
            (new Regex("г", RegexOptions.Compiled), "h"),
            (new Regex("д", RegexOptions.Compiled), "d"),
            (new Regex("е", RegexOptions.Compiled), "e"),
            (new Regex("з", RegexOptions.Compiled), "z"),
            (new Regex("и", RegexOptions.Compiled), "y"),
            (new Regex("і", RegexOptions.Compiled), "i"),
            (new Regex("й", RegexOptions.Compiled), "j"),
            (new Regex("к", RegexOptions.Compiled), "k"),
            (new Regex("л", RegexOptions.Compiled), "l"),
            (new Regex("м", RegexOptions.Compiled), "m"),
            (new Regex("н", RegexOptions.Compiled), "n"),
            (new Regex("о", RegexOptions.Compiled), "o"),
            (new Regex("п", RegexOptions.Compiled), "p"),
            (new Regex("р", RegexOptions.Compiled), "r"),
            (new Regex("с", RegexOptions.Compiled), "s"),
            (new Regex("т", RegexOptions.Compiled), "t"),
            (new Regex("у", RegexOptions.Compiled), "u"),
            (new Regex("ф", RegexOptions.Compiled), "f"),
            (new Regex("ц", RegexOptions.Compiled), "c"),
            (new Regex("ь", RegexOptions.Compiled), ""),
            (new Regex("ъ", RegexOptions.Compiled), ""),
            (new Regex("ы", RegexOptions.Compiled), "y"),
            (new Regex("э", RegexOptions.Compiled), "e"),
            (new Regex("ё", RegexOptions.Compiled), "io"),
            (new Regex("['\"`’ʼ]", RegexOptions.Compiled), "")
        };

        private static readonly Regex PrefixPattern = new Regex(
            @"^(вул\.|вулиця|просп\.|проспект|пров\.|провулок|пл\.|площа|бульв\.|бульвар|ul\.|ulica|al\.|aleja|aleje|pl\.|plac|os\.|osiedle|skwer|rondo)\s+",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex CyrillicDetector = new Regex(@"[\u0400-\u04FF]", RegexOptions.Compiled);
        private static readonly Regex PostalCodeRegex = new Regex(@"^\d{2}-\d{3}$", RegexOptions.Compiled);
        private static readonly Regex NonAlphanumericRegex = new Regex(@"[^a-z0-9\s]", RegexOptions.Compiled);
        private static readonly Regex MultiSpaceRegex = new Regex(@"\s+", RegexOptions.Compiled);

        public static string StripPolishDiacritics(string text)
        {
            if (string.IsNullOrEmpty(text)) return string.Empty;
            var sb = new StringBuilder(text.Length);
            foreach (var ch in text)
            {
                if (PolishDiacriticsMap.TryGetValue(ch, out var replacement))
                    sb.Append(replacement);
                else
                    sb.Append(ch);
            }
            return sb.ToString();
        }

        public static string TransliterateCyrillic(string text)
        {
            if (string.IsNullOrEmpty(text)) return string.Empty;
            var lower = PrefixPattern.Replace(text.Trim(), "").Trim().ToLowerInvariant();

            if (KnownCyrillicWords.TryGetValue(lower, out var exactMatch))
            {
                return exactMatch;
            }

            foreach (var kvp in KnownCyrillicWords)
            {
                if (lower.Contains(kvp.Key))
                {
                    lower = lower.Replace(kvp.Key, kvp.Value);
                }
            }

            foreach (var (pattern, replacement) in CyrillicPhonetics)
            {
                lower = pattern.Replace(lower, replacement);
            }

            return lower;
        }

        public static string NormalizeText(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;

            var normalized = PrefixPattern.Replace(text.Trim(), "").Trim();

            if (CyrillicDetector.IsMatch(normalized))
            {
                normalized = TransliterateCyrillic(normalized);
            }

            normalized = StripPolishDiacritics(normalized.ToLowerInvariant());
            normalized = NonAlphanumericRegex.Replace(normalized, " ");
            normalized = MultiSpaceRegex.Replace(normalized, " ").Trim();

            return normalized;
        }

        public static string? NormalizePostalCode(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return null;

            var digits = new StringBuilder(5);
            foreach (var ch in input)
            {
                if (char.IsDigit(ch)) digits.Append(ch);
            }

            if (digits.Length != 5) return null;
            return $"{digits[0]}{digits[1]}-{digits[2]}{digits[3]}{digits[4]}";
        }

        public static bool IsValidPostalCode(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return false;
            return PostalCodeRegex.IsMatch(input.Trim());
        }

        public static string NormalizeBuildingNumber(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;

            var cleaned = input.Trim().ToUpperInvariant();

            var slashIdx = cleaned.IndexOf('/');
            if (slashIdx != -1) cleaned = cleaned.Substring(0, slashIdx).Trim();

            var mIdx = cleaned.IndexOf(" M ");
            if (mIdx != -1) cleaned = cleaned.Substring(0, mIdx).Trim();

            var mDotIdx = cleaned.IndexOf(" M.");
            if (mDotIdx != -1) cleaned = cleaned.Substring(0, mDotIdx).Trim();

            return cleaned.Replace(" ", "");
        }

        /// <summary>
        /// Extracts integer numeric part from building number for parity and range evaluation.
        /// Examples: "12" -> 12, "12A" -> 12, "15/17" -> 15, "4A" -> 4.
        /// </summary>
        public static int? ExtractBuildingNumericPart(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return null;
            var normalized = NormalizeBuildingNumber(input);
            if (string.IsNullOrEmpty(normalized)) return null;

            var match = Regex.Match(normalized, @"^(\d+)");
            if (!match.Success) return null;

            if (int.TryParse(match.Groups[1].Value, out var val))
            {
                return val;
            }
            return null;
        }
    }
}
